#!/usr/bin/env node
/**
 * merge.ts — Combines core/ + stacks/<name>/ into a ready-to-install output folder.
 *
 * Usage:
 *   npx tsx scaffolder/merge.ts <stack-name> [--output <dir>]
 *
 * Examples:
 *   npx tsx scaffolder/merge.ts nestjs
 *   npx tsx scaffolder/merge.ts generic-ts --output ./out
 *
 * Merge rules:
 * - core/skills/ files are copied first (baseline)
 * - stack/skills/ files override core files with the same relative path
 * - stack/agents/, stack/rules/, stack/hooks/, stack/scripts/ are copied as-is
 * - core/hooks/ are copied; stack/hooks/ override same-named files
 * - CLAUDE.md, settings.json come from the stack (not core templates)
 * - README.md, STATUS.md, and other repo-meta files are excluded from output
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { existsSync, mkdirSync, cpSync, readdirSync, statSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve, relative, basename, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const stackName = args.find((a) => !a.startsWith("--"));
const outputIdx = args.indexOf("--output");
const outputDir = outputIdx !== -1 ? args[outputIdx + 1] : undefined;

if (!stackName) {
  console.error("Usage: npx tsx scaffolder/merge.ts <stack-name> [--output <dir>]");
  console.error("Available stacks:");
  const stacksDir = resolve(__dirname, "../stacks");
  if (existsSync(stacksDir)) {
    for (const entry of readdirSync(stacksDir)) {
      if (statSync(join(stacksDir, entry)).isDirectory()) {
        console.error(`  - ${entry}`);
      }
    }
  }
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const CORE_DIR = join(ROOT, "core");
const STACK_DIR = join(ROOT, "stacks", stackName);
const OUTPUT = resolve(outputDir ?? join(ROOT, "output", stackName));

if (!existsSync(STACK_DIR)) {
  console.error(`Error: Stack "${stackName}" not found at ${STACK_DIR}`);
  process.exit(1);
}

// Files to exclude from output (repo-meta, not part of the .claude/ install)
const EXCLUDE_FILES = new Set([
  "README.md",
  "STATUS.md",
  "CONTRIBUTING.md",
  ".gitignore",
  ".DS_Store",
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

function copyDir(src: string, dest: string, excludes = EXCLUDE_FILES): void {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });

  for (const entry of readdirSync(src, { withFileTypes: true })) {
    if (excludes.has(entry.name)) continue;
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath, excludes);
    } else {
      cpSync(srcPath, destPath);
    }
  }
}

function copyFile(src: string, dest: string): void {
  const dir = join(dest, "..");
  mkdirSync(dir, { recursive: true });
  cpSync(src, dest);
}

// ─── Clean Output ─────────────────────────────────────────────────────────────

if (existsSync(OUTPUT)) {
  rmSync(OUTPUT, { recursive: true });
}
mkdirSync(OUTPUT, { recursive: true });

// Output structure:
// output/<stack>/
//   .claude/
//     skills/
//     agents/
//     hooks/
//     rules/
//     scripts/        (if stack has them)
//     settings.json
//     settings.local.json.example
//     observed-patterns.md (if stack has it)
//   CLAUDE.md
//   CLAUDE.local.md.example

const DOTCLAUDE = join(OUTPUT, ".claude");
mkdirSync(DOTCLAUDE, { recursive: true });

// ─── Step 1: Copy core skills (baseline) ──────────────────────────────────────

const coreSkills = join(CORE_DIR, "skills");
const outSkills = join(DOTCLAUDE, "skills");
copyDir(coreSkills, outSkills);
console.log(`[core] skills → ${relative(ROOT, outSkills)}`);

// ─── Step 2: Merge hooks (core + stack composed) ─────────────────────────────

const coreHooks = join(CORE_DIR, "hooks");
const stackHooks = join(STACK_DIR, "hooks");
const outHooks = join(DOTCLAUDE, "hooks");
mkdirSync(outHooks, { recursive: true });

// For hooks: if both core and stack have the same file, COMPOSE them (core first, then stack).
// If only core has it, copy core. If only stack has it, copy stack.
const coreHookFiles = existsSync(coreHooks)
  ? readdirSync(coreHooks).filter((f) => f.endsWith(".sh"))
  : [];
const stackHookFiles = existsSync(stackHooks)
  ? readdirSync(stackHooks).filter((f) => f.endsWith(".sh"))
  : [];
const allHookNames = new Set([...coreHookFiles, ...stackHookFiles]);

for (const hookFile of allHookNames) {
  const corePath = join(coreHooks, hookFile);
  const stackPath = join(stackHooks, hookFile);
  const outPath = join(outHooks, hookFile);

  const coreExists = existsSync(corePath);
  const stackExists = existsSync(stackPath);

  if (coreExists && stackExists) {
    // Compose: inline core content first, then stack additions
    const coreContent = readFileSync(corePath, "utf-8");
    const stackContent = readFileSync(stackPath, "utf-8");

    // Strip the shebang from the stack version (we keep core's shebang)
    const stackBody = stackContent.replace(/^#!.*\n/, "");

    const composed = `${coreContent}

# ─── Stack-specific additions (${stackName}) ────────────────────────────────
${stackBody}`;

    writeFileSync(outPath, composed);
    console.log(`[merged] hooks/${hookFile} (core + stack composed)`);
  } else if (coreExists) {
    cpSync(corePath, outPath);
    console.log(`[core] hooks/${hookFile}`);
  } else {
    cpSync(stackPath, outPath);
    console.log(`[stack] hooks/${hookFile}`);
  }
}

// ─── Step 3: Overlay stack files ──────────────────────────────────────────────

// Stack skills override core skills (same relative path wins)
const stackSkills = join(STACK_DIR, "skills");
if (existsSync(stackSkills)) {
  copyDir(stackSkills, outSkills);
  console.log(`[stack] skills → ${relative(ROOT, outSkills)} (override)`);
}

// Stack agents (no core baseline for agents — they're always stack-specific)
const stackAgents = join(STACK_DIR, "agents");
const outAgents = join(DOTCLAUDE, "agents");
if (existsSync(stackAgents)) {
  copyDir(stackAgents, outAgents);
  console.log(`[stack] agents → ${relative(ROOT, outAgents)}`);
}

// Stack rules
const stackRules = join(STACK_DIR, "rules");
const outRules = join(DOTCLAUDE, "rules");
if (existsSync(stackRules)) {
  copyDir(stackRules, outRules);
  console.log(`[stack] rules → ${relative(ROOT, outRules)}`);
}

// Stack scripts (detect.ts, apply.ts — if present)
const stackScripts = join(STACK_DIR, "scripts");
const outScripts = join(DOTCLAUDE, "scripts");
if (existsSync(stackScripts)) {
  copyDir(stackScripts, outScripts);
  console.log(`[stack] scripts → ${relative(ROOT, outScripts)}`);
}

// ─── Step 4: Copy root-level stack files ──────────────────────────────────────

// CLAUDE.md → output root (not inside .claude/)
const stackClaude = join(STACK_DIR, "CLAUDE.md");
if (existsSync(stackClaude)) {
  copyFile(stackClaude, join(OUTPUT, "CLAUDE.md"));
  console.log(`[stack] CLAUDE.md → ${relative(ROOT, join(OUTPUT, "CLAUDE.md"))}`);
}

// CLAUDE.local.md.example → output root
const stackClaudeLocal = join(STACK_DIR, "CLAUDE.local.md.example");
if (existsSync(stackClaudeLocal)) {
  copyFile(stackClaudeLocal, join(OUTPUT, "CLAUDE.local.md.example"));
}

// settings.json → .claude/settings.json
const stackSettings = join(STACK_DIR, "settings.json");
if (existsSync(stackSettings)) {
  copyFile(stackSettings, join(DOTCLAUDE, "settings.json"));
  console.log(`[stack] settings.json → ${relative(ROOT, join(DOTCLAUDE, "settings.json"))}`);
}

// settings.local.json.example → .claude/
const stackLocalSettings = join(STACK_DIR, "settings.local.json.example");
if (existsSync(stackLocalSettings)) {
  copyFile(stackLocalSettings, join(DOTCLAUDE, "settings.local.json.example"));
}

// observed-patterns.md → .claude/ (if exists)
const stackPatterns = join(STACK_DIR, "observed-patterns.md");
if (existsSync(stackPatterns)) {
  copyFile(stackPatterns, join(DOTCLAUDE, "observed-patterns.md"));
  console.log(`[stack] observed-patterns.md → .claude/`);
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`\nMerge complete: ${OUTPUT}`);
console.log(`\nTo install into a project, run:`);
console.log(`  npx tsx installer/install.ts ${stackName} /path/to/your/project`);
