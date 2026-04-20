#!/usr/bin/env node
/**
 * update.ts — Pulls updates from core/ and stacks/ into an already-installed repo.
 *
 * Usage:
 *   npx tsx installer/update.ts <stack-name> <target-repo-path> [--dry-run]
 *
 * Update rules:
 * - core/skills/ → overwrites (these are meant to be identical everywhere)
 * - core/hooks/ → overwrites (security hooks shouldn't diverge)
 * - stack/skills/ that override core → overwrites
 * - stack/agents/ → overwrites
 * - stack/hooks/ → overwrites
 * - stack/rules/ → SHOWS DIFF, does not overwrite (these are customized per-repo)
 * - stack/scripts/ → overwrites (mechanical, not opinionated)
 * - CLAUDE.md → SHOWS DIFF (user may have customized)
 * - settings.json → deep-merges (preserves user additions)
 * - *.local.* files → NEVER touched
 * - rules.local/ → NEVER touched
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { existsSync, readFileSync, writeFileSync, cpSync, mkdirSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((a) => !a.startsWith("--"));
const stackName = positional[0];
const targetPath = positional[1];

if (!stackName || !targetPath) {
  console.error("Usage: npx tsx installer/update.ts <stack-name> <target-repo-path> [--dry-run]");
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const CORE_DIR = join(ROOT, "core");
const STACK_DIR = join(ROOT, "stacks", stackName);
const TARGET = resolve(targetPath);
const TARGET_DOTCLAUDE = join(TARGET, ".claude");

if (!existsSync(TARGET_DOTCLAUDE)) {
  console.error(`Error: ${TARGET_DOTCLAUDE} does not exist. Run install.ts first.`);
  process.exit(1);
}

if (!existsSync(STACK_DIR)) {
  console.error(`Error: Stack "${stackName}" not found.`);
  process.exit(1);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type Action = "overwrite" | "diff" | "skip" | "merge";

interface UpdateEntry {
  source: string;
  dest: string;
  action: Action;
  reason: string;
}

const plan: UpdateEntry[] = [];

function planDir(src: string, dest: string, action: Action, reason: string): void {
  if (!existsSync(src)) return;
  for (const entry of readdirSync(src, { withFileTypes: true, recursive: true })) {
    if (entry.isDirectory()) continue;
    const entryPath = join(entry.parentPath ?? entry.path, entry.name);
    const rel = relative(src, entryPath);
    // Never touch .local files
    if (rel.includes(".local")) continue;
    plan.push({
      source: entryPath,
      dest: join(dest, rel),
      action,
      reason,
    });
  }
}

function filesEqual(a: string, b: string): boolean {
  if (!existsSync(a) || !existsSync(b)) return false;
  return readFileSync(a, "utf-8") === readFileSync(b, "utf-8");
}

function deepMergeJson(base: Record<string, any>, overlay: Record<string, any>): Record<string, any> {
  const result = { ...base };
  for (const [key, value] of Object.entries(overlay)) {
    if (value && typeof value === "object" && !Array.isArray(value) && result[key] && typeof result[key] === "object") {
      result[key] = deepMergeJson(result[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

// ─── Build Plan ───────────────────────────────────────────────────────────────

// Core skills → overwrite
planDir(join(CORE_DIR, "skills"), join(TARGET_DOTCLAUDE, "skills"), "overwrite", "core skill (kept identical)");

// Core hooks → overwrite
planDir(join(CORE_DIR, "hooks"), join(TARGET_DOTCLAUDE, "hooks"), "overwrite", "core hook (security)");

// Stack skills → overwrite (these override core)
planDir(join(STACK_DIR, "skills"), join(TARGET_DOTCLAUDE, "skills"), "overwrite", "stack skill override");

// Stack hooks → overwrite
planDir(join(STACK_DIR, "hooks"), join(TARGET_DOTCLAUDE, "hooks"), "overwrite", "stack hook");

// Stack agents → overwrite
planDir(join(STACK_DIR, "agents"), join(TARGET_DOTCLAUDE, "agents"), "overwrite", "stack agent");

// Stack rules → diff only (user customizes these)
planDir(join(STACK_DIR, "rules"), join(TARGET_DOTCLAUDE, "rules"), "diff", "stack rule (review diff)");

// Stack scripts → overwrite (mechanical)
planDir(join(STACK_DIR, "scripts"), join(TARGET_DOTCLAUDE, "scripts"), "overwrite", "stack script");

// CLAUDE.md → diff
const stackClaude = join(STACK_DIR, "CLAUDE.md");
if (existsSync(stackClaude)) {
  plan.push({
    source: stackClaude,
    dest: join(TARGET, "CLAUDE.md"),
    action: "diff",
    reason: "CLAUDE.md (review diff — may be customized)",
  });
}

// settings.json → merge
const stackSettings = join(STACK_DIR, "settings.json");
if (existsSync(stackSettings)) {
  plan.push({
    source: stackSettings,
    dest: join(TARGET_DOTCLAUDE, "settings.json"),
    action: "merge",
    reason: "settings.json (deep-merge)",
  });
}

// ─── Execute Plan ─────────────────────────────────────────────────────────────

let overwrites = 0;
let diffs = 0;
let skips = 0;
let merges = 0;

for (const entry of plan) {
  if (filesEqual(entry.source, entry.dest)) {
    skips++;
    continue;
  }

  switch (entry.action) {
    case "overwrite":
      if (dryRun) {
        console.log(`[would overwrite] ${relative(TARGET, entry.dest)} — ${entry.reason}`);
      } else {
        mkdirSync(join(entry.dest, ".."), { recursive: true });
        cpSync(entry.source, entry.dest);
        console.log(`[overwritten] ${relative(TARGET, entry.dest)}`);
      }
      overwrites++;
      break;

    case "diff":
      if (!existsSync(entry.dest)) {
        if (dryRun) {
          console.log(`[would create] ${relative(TARGET, entry.dest)} — ${entry.reason}`);
        } else {
          mkdirSync(join(entry.dest, ".."), { recursive: true });
          cpSync(entry.source, entry.dest);
          console.log(`[created] ${relative(TARGET, entry.dest)}`);
        }
        overwrites++;
      } else {
        console.log(`\n[DIFF] ${relative(TARGET, entry.dest)} — ${entry.reason}`);
        try {
          const diff = execSync(
            `diff -u "${entry.dest}" "${entry.source}" | head -50`,
            { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }
          );
          if (diff.trim()) console.log(diff);
        } catch (e: any) {
          if (e.stdout) console.log(e.stdout.toString().slice(0, 2000));
        }
        diffs++;
      }
      break;

    case "merge":
      if (!existsSync(entry.dest)) {
        if (!dryRun) {
          cpSync(entry.source, entry.dest);
          console.log(`[created] ${relative(TARGET, entry.dest)}`);
        }
        overwrites++;
      } else {
        try {
          const existing = JSON.parse(readFileSync(entry.dest, "utf-8"));
          const incoming = JSON.parse(readFileSync(entry.source, "utf-8"));
          const merged = deepMergeJson(existing, incoming);
          if (dryRun) {
            console.log(`[would merge] ${relative(TARGET, entry.dest)}`);
          } else {
            writeFileSync(entry.dest, JSON.stringify(merged, null, 2) + "\n");
            console.log(`[merged] ${relative(TARGET, entry.dest)}`);
          }
          merges++;
        } catch {
          console.log(`[skip] ${relative(TARGET, entry.dest)} — could not parse JSON`);
          skips++;
        }
      }
      break;

    case "skip":
      skips++;
      break;
  }
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`
Update ${dryRun ? "(dry run) " : ""}summary:
  Overwritten: ${overwrites}
  Diffs shown: ${diffs} (review and apply manually if needed)
  Merged:      ${merges}
  Unchanged:   ${skips}
${diffs > 0 ? "\nFiles with diffs were NOT overwritten. Review the diffs above and apply manually." : ""}
`);
