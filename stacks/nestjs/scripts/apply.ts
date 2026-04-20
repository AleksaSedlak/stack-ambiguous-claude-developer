#!/usr/bin/env tsx
/**
 * apply.ts — Read a Detection JSON from stdin and personalize the .claude/ template
 *            to the target project.
 *
 * Usage:
 *   npx tsx .claude/scripts/detect.ts | npx tsx .claude/scripts/apply.ts           # dry-run (default)
 *   npx tsx .claude/scripts/detect.ts | npx tsx .claude/scripts/apply.ts --apply   # actually mutate files
 *   npx tsx .claude/scripts/apply.ts --input detection.json --apply                # read JSON from a file
 *
 * Default is --dry-run: prints every planned action but writes nothing. You must
 * pass --apply explicitly to mutate files.
 *
 * What apply.ts does (in order):
 *   1. Fill `<!-- CLAUDE_REPLACE:key --> ... <!-- /CLAUDE_REPLACE:key -->` sections
 *      in `.claude/CLAUDE.md` from `detection.claudeMdReplacements`.
 *   2. Rewrite YAML-frontmatter `paths:` arrays in rule files per
 *      `detection.recommendedRulePathRewrites`.
 *   3. Delete files listed in `detection.recommendedDeletes` (e.g. rules/database.md
 *      when no ORM was detected).
 *
 * No dependencies — uses only Node built-ins.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  statSync,
} from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { argv, stdin, stdout, stderr, exit } from "node:process";

// ──────────────────────────────────────────────────────────
// Types — must stay in sync with detect.ts
// ──────────────────────────────────────────────────────────

interface RulePathRewrite {
  file: string;
  addPaths: string[];
  removePaths: string[];
}

interface Detection {
  schemaVersion: 1 | 2;
  projectRoot: string;
  scannedAt?: string;
  // We accept any extra fields — apply.ts only reads the three below + metadata
  claudeMdReplacements: Record<string, string>;
  recommendedRulePathRewrites: RulePathRewrite[];
  recommendedDeletes: string[];
  warnings: string[];
  errors: string[];
  // v2 additions (optional so v1 still parses)
  observedPatterns?: {
    sampledFiles: string[];
    namingConvention: string;
    controllerFileLayout: string;
    dtoLocation: string;
    constructorInjection: string;
    notes: string[];
  };
  monorepo?: {
    isMonorepo: boolean;
    tool: string | null;
    workspaces: string[];
    apps?: Array<{ name: string; path: string }>;
  };
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────
// Plan entries — one per planned action
// ──────────────────────────────────────────────────────────

type PlanEntry =
  | {
      kind: "replace";
      file: string;
      key: string;
      oldLen: number;
      newLen: number;
    }
  | { kind: "rewrite-paths"; file: string; added: string[]; removed: string[] }
  | { kind: "delete"; file: string }
  | { kind: "skip"; file: string; reason: string }
  | { kind: "warn"; message: string }
  | { kind: "error"; message: string };

// ──────────────────────────────────────────────────────────
// CLI parsing
// ──────────────────────────────────────────────────────────

interface Args {
  apply: boolean;
  inputPath: string | null;
  claudeDir: string | null;
}

function parseArgs(args: string[]): Args {
  let apply = false;
  let inputPath: string | null = null;
  let claudeDir: string | null = null;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--apply") apply = true;
    else if (a === "--dry-run") apply = false;
    else if (a === "--input" && args[i + 1]) inputPath = resolve(args[++i]!);
    else if (a === "--claude-dir" && args[i + 1])
      claudeDir = resolve(args[++i]!);
    else if (a === "--help" || a === "-h") {
      stderr.write(
        [
          "Usage: apply.ts [--apply] [--dry-run] [--input <file>] [--claude-dir <dir>]",
          "",
          "Reads a Detection JSON (from stdin or --input) and personalizes the",
          ".claude/ template. Default mode is --dry-run; pass --apply to mutate.",
          "",
          "--claude-dir  override the .claude directory location (default:",
          "              <detection.projectRoot>/.claude)",
        ].join("\n") + "\n",
      );
      exit(0);
    }
  }

  return { apply, inputPath, claudeDir };
}

// ──────────────────────────────────────────────────────────
// Input reading
// ──────────────────────────────────────────────────────────

async function readStdin(): Promise<string> {
  return new Promise((resolvePromise, rejectPromise) => {
    const chunks: Buffer[] = [];
    stdin.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    stdin.on("end", () =>
      resolvePromise(Buffer.concat(chunks).toString("utf8")),
    );
    stdin.on("error", rejectPromise);
  });
}

async function loadDetection(inputPath: string | null): Promise<Detection> {
  let raw: string;
  if (inputPath) {
    raw = readFileSync(inputPath, "utf8");
  } else {
    if (stdin.isTTY) {
      throw new Error(
        "No input. Pipe detect.ts output into apply.ts, or pass --input <file>.",
      );
    }
    raw = await readStdin();
  }
  const parsed = JSON.parse(raw) as Detection;
  if (parsed.schemaVersion !== 1 && parsed.schemaVersion !== 2) {
    throw new Error(
      `Unsupported Detection schemaVersion ${parsed.schemaVersion}. Expected 1 or 2.`,
    );
  }
  return parsed;
}

// ──────────────────────────────────────────────────────────
// Step 1 — fill CLAUDE.md markers
// ──────────────────────────────────────────────────────────

/**
 * Replace the content between paired markers:
 *   <!-- CLAUDE_REPLACE:key -->
 *   ...old content...
 *   <!-- /CLAUDE_REPLACE:key -->
 *
 * If a key is present in `replacements` but no markers are found, we record a
 * warning (not an error) so the user knows the template was edited.
 */
function fillMarkers(
  source: string,
  replacements: Record<string, string>,
): { result: string; entries: PlanEntry[]; file: string } {
  let result = source;
  const entries: PlanEntry[] = [];
  for (const [key, newContent] of Object.entries(replacements)) {
    const open = `<!-- CLAUDE_REPLACE:${key} -->`;
    const close = `<!-- /CLAUDE_REPLACE:${key} -->`;
    const openIdx = result.indexOf(open);
    const closeIdx = result.indexOf(close);
    if (openIdx === -1 || closeIdx === -1 || closeIdx < openIdx) {
      entries.push({
        kind: "warn",
        message: `CLAUDE.md: marker pair for "${key}" not found — skipping`,
      });
      continue;
    }
    const before = result.slice(0, openIdx + open.length);
    const after = result.slice(closeIdx);
    const oldInner = result.slice(openIdx + open.length, closeIdx);
    // Preserve one blank line on each side of the replaced block for readability
    const replaced = `\n${newContent}\n`;
    result = before + replaced + after;
    entries.push({
      kind: "replace",
      file: "CLAUDE.md",
      key,
      oldLen: oldInner.length,
      newLen: replaced.length,
    });
  }
  return { result, entries, file: "CLAUDE.md" };
}

// ──────────────────────────────────────────────────────────
// Step 2 — rewrite `paths:` array in rule frontmatter
// ──────────────────────────────────────────────────────────

/**
 * Very small YAML-frontmatter editor. We only touch the `paths:` array and only
 * when frontmatter is delimited by `---` on its own lines at the top of the
 * file. Anything more exotic is left untouched and a warning is emitted.
 */
function rewritePathsFrontmatter(
  source: string,
  add: string[],
  remove: string[],
): {
  result: string;
  changed: boolean;
  added: string[];
  removed: string[];
  reason?: string;
} {
  const lines = source.split("\n");
  if (lines[0] !== "---") {
    return {
      result: source,
      changed: false,
      added: [],
      removed: [],
      reason: "no frontmatter",
    };
  }

  // Find closing `---`
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end === -1) {
    return {
      result: source,
      changed: false,
      added: [],
      removed: [],
      reason: "unterminated frontmatter",
    };
  }

  // Locate paths: line
  let pathsStart = -1;
  for (let i = 1; i < end; i++) {
    if (/^paths\s*:\s*$/.test(lines[i]!)) {
      pathsStart = i;
      break;
    }
  }

  const currentPaths: string[] = [];
  let pathsEnd = pathsStart; // exclusive end (index after last `-` item)
  if (pathsStart !== -1) {
    for (let i = pathsStart + 1; i < end; i++) {
      const m = lines[i]!.match(/^\s*-\s*(?:"([^"]*)"|'([^']*)'|(\S.*?))\s*$/);
      if (!m) break;
      const val = m[1] ?? m[2] ?? m[3] ?? "";
      currentPaths.push(val);
      pathsEnd = i + 1;
    }
  }

  // Compute the new list
  const removeSet = new Set(remove);
  const kept = currentPaths.filter((p) => !removeSet.has(p));
  const existing = new Set(kept);
  const actuallyAdded: string[] = [];
  for (const a of add) {
    if (!existing.has(a)) {
      kept.push(a);
      existing.add(a);
      actuallyAdded.push(a);
    }
  }
  const actuallyRemoved = currentPaths.filter((p) => removeSet.has(p));

  if (actuallyAdded.length === 0 && actuallyRemoved.length === 0) {
    return { result: source, changed: false, added: [], removed: [] };
  }

  // Build the new paths block
  const newBlock = ["paths:", ...kept.map((p) => `  - "${p}"`)];

  let newLines: string[];
  if (pathsStart === -1) {
    // No `paths:` at all — insert before the closing `---`
    newLines = [...lines.slice(0, end), ...newBlock, ...lines.slice(end)];
  } else {
    newLines = [
      ...lines.slice(0, pathsStart),
      ...newBlock,
      ...lines.slice(pathsEnd),
    ];
  }

  return {
    result: newLines.join("\n"),
    changed: true,
    added: actuallyAdded,
    removed: actuallyRemoved,
  };
}

// ──────────────────────────────────────────────────────────
// Orchestration
// ──────────────────────────────────────────────────────────

function resolveClaudeDir(
  detection: Detection,
  override: string | null,
): string {
  if (override) return override;
  const candidate = join(detection.projectRoot, ".claude");
  return candidate;
}

function planAndExecute(
  detection: Detection,
  claudeDir: string,
  apply: boolean,
): {
  entries: PlanEntry[];
  writes: Array<{ file: string; content: string }>;
  deletes: string[];
} {
  const entries: PlanEntry[] = [];
  const writes: Array<{ file: string; content: string }> = [];
  const deletes: string[] = [];

  // Pass through warnings/errors from detection
  for (const w of detection.warnings)
    entries.push({ kind: "warn", message: `detect: ${w}` });
  for (const e of detection.errors)
    entries.push({ kind: "error", message: `detect: ${e}` });

  // --- Step 1: CLAUDE.md markers
  const claudeMdPath = join(claudeDir, "CLAUDE.md");
  if (!existsSync(claudeMdPath)) {
    entries.push({
      kind: "warn",
      message: `CLAUDE.md not found at ${claudeMdPath} — skipping marker fills`,
    });
  } else if (Object.keys(detection.claudeMdReplacements).length > 0) {
    const source = readFileSync(claudeMdPath, "utf8");
    const { result, entries: fillEntries } = fillMarkers(
      source,
      detection.claudeMdReplacements,
    );
    entries.push(...fillEntries);
    if (result !== source) {
      writes.push({ file: claudeMdPath, content: result });
    }
  }

  // --- Step 1b: fill observed-patterns.md (if the template file exists)
  const observedPath = join(claudeDir, "observed-patterns.md");
  if (
    existsSync(observedPath) &&
    Object.keys(detection.claudeMdReplacements).length > 0
  ) {
    const source = readFileSync(observedPath, "utf8");
    const { result, entries: fillEntries } = fillMarkers(
      source,
      detection.claudeMdReplacements,
    );
    // Rewrite the plan entries to reference observed-patterns.md instead of CLAUDE.md
    const rewritten = fillEntries.map((e) =>
      e.kind === "replace" ? { ...e, file: "observed-patterns.md" } : e,
    );
    // Only keep the ones that actually matched in this file (fillMarkers warns for missing keys per file)
    for (const e of rewritten) {
      if (e.kind === "replace" && e.file === "observed-patterns.md")
        entries.push(e);
      // suppress the "marker not found" warnings from observed-patterns.md — only CLAUDE.md's set matters
    }
    if (result !== source) {
      writes.push({ file: observedPath, content: result });
    }
  }

  // --- Step 2: rule path rewrites
  for (const rewrite of detection.recommendedRulePathRewrites) {
    // `rewrite.file` is relative to the .claude/ dir (e.g. "rules/api.md")
    const filePath = join(claudeDir, rewrite.file);
    if (!existsSync(filePath)) {
      entries.push({
        kind: "skip",
        file: rewrite.file,
        reason: "file does not exist",
      });
      continue;
    }
    const source = readFileSync(filePath, "utf8");
    const { result, changed, added, removed, reason } = rewritePathsFrontmatter(
      source,
      rewrite.addPaths,
      rewrite.removePaths,
    );
    if (!changed) {
      entries.push({
        kind: "skip",
        file: rewrite.file,
        reason: reason ?? "no changes needed",
      });
      continue;
    }
    entries.push({
      kind: "rewrite-paths",
      file: rewrite.file,
      added,
      removed,
    });
    writes.push({ file: filePath, content: result });
  }

  // --- Step 3: recommended deletes
  for (const rel of detection.recommendedDeletes) {
    // Paths are given as ".claude/rules/foo.md" — strip the leading ".claude/"
    const relative = rel.startsWith(".claude/")
      ? rel.slice(".claude/".length)
      : rel;
    const abs = join(claudeDir, relative);
    if (!existsSync(abs)) {
      entries.push({ kind: "skip", file: rel, reason: "already gone" });
      continue;
    }
    entries.push({ kind: "delete", file: rel });
    deletes.push(abs);
  }

  // --- Actually apply?
  if (apply) {
    for (const w of writes) {
      writeFileSync(w.file, w.content, "utf8");
    }
    for (const d of deletes) {
      try {
        const s = statSync(d);
        if (s.isFile()) unlinkSync(d);
        else
          entries.push({
            kind: "warn",
            message: `refusing to delete non-file: ${d}`,
          });
      } catch (err) {
        entries.push({
          kind: "warn",
          message: `failed to delete ${d}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  return { entries, writes, deletes };
}

// ──────────────────────────────────────────────────────────
// Output formatting
// ──────────────────────────────────────────────────────────

function renderPlan(
  entries: PlanEntry[],
  writes: Array<{ file: string; content: string }>,
  deletes: string[],
  apply: boolean,
  claudeDir: string,
): string {
  const lines: string[] = [];
  lines.push(
    apply ? "# apply.ts — APPLIED" : "# apply.ts — DRY RUN (no files changed)",
  );
  lines.push(`# .claude dir: ${claudeDir}`);
  lines.push("");

  let replaceCount = 0;
  let rewriteCount = 0;
  let deleteCount = 0;
  let skipCount = 0;
  let warnCount = 0;
  let errorCount = 0;

  for (const e of entries) {
    switch (e.kind) {
      case "replace":
        lines.push(
          `  [fill]    ${e.file} :: ${e.key}  (${e.oldLen} -> ${e.newLen} chars)`,
        );
        replaceCount++;
        break;
      case "rewrite-paths":
        lines.push(`  [paths]   ${e.file}`);
        for (const a of e.added) lines.push(`              + ${a}`);
        for (const r of e.removed) lines.push(`              - ${r}`);
        rewriteCount++;
        break;
      case "delete":
        lines.push(`  [delete]  ${e.file}`);
        deleteCount++;
        break;
      case "skip":
        lines.push(`  [skip]    ${e.file}  (${e.reason})`);
        skipCount++;
        break;
      case "warn":
        lines.push(`  [warn]    ${e.message}`);
        warnCount++;
        break;
      case "error":
        lines.push(`  [error]   ${e.message}`);
        errorCount++;
        break;
    }
  }

  lines.push("");
  lines.push(
    `Summary: ${replaceCount} fills, ${rewriteCount} path rewrites, ${deleteCount} deletes, ${skipCount} skips, ${warnCount} warnings, ${errorCount} errors.`,
  );
  if (!apply && replaceCount + rewriteCount + deleteCount > 0) {
    lines.push("");
    lines.push("Re-run with --apply to actually make these changes.");
  }
  return lines.join("\n") + "\n";
}

// ──────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(argv.slice(2));

  let detection: Detection;
  try {
    detection = await loadDetection(args.inputPath);
  } catch (err) {
    stderr.write(
      `apply.ts: ${err instanceof Error ? err.message : String(err)}\n`,
    );
    exit(1);
  }

  const claudeDir = resolveClaudeDir(detection, args.claudeDir);

  if (!existsSync(claudeDir)) {
    stderr.write(`apply.ts: .claude directory not found at ${claudeDir}\n`);
    stderr.write("Pass --claude-dir to override.\n");
    exit(1);
  }

  const { entries, writes, deletes } = planAndExecute(
    detection,
    claudeDir,
    args.apply,
  );

  stdout.write(renderPlan(entries, writes, deletes, args.apply, claudeDir));

  const hadErrors = entries.some((e) => e.kind === "error");
  exit(hadErrors ? 1 : 0);
}

main();
