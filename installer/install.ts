#!/usr/bin/env node
/**
 * install.ts — Takes a merged stack output and installs it into a target repo.
 *
 * Usage:
 *   npx tsx installer/install.ts <stack-name> <target-repo-path> [--force]
 *
 * Examples:
 *   npx tsx installer/install.ts nestjs /Users/me/projects/my-api
 *   npx tsx installer/install.ts generic-ts ./my-project --force
 *
 * What it does:
 * 1. Runs merge.ts for the specified stack (if output doesn't exist yet)
 * 2. Copies .claude/ folder to target repo
 * 3. Copies CLAUDE.md to target repo root
 * 4. Copies CLAUDE.local.md.example to target repo root
 * 5. Prints next steps
 *
 * Safety:
 * - Will NOT overwrite existing .claude/ or CLAUDE.md unless --force is passed
 * - Never touches .env, secrets, or other sensitive files
 * - Creates a .claude/.gitignore to exclude local files
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { existsSync, mkdirSync, cpSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes("--force");
const positional = args.filter((a) => !a.startsWith("--"));
const stackName = positional[0];
const targetPath = positional[1];

if (!stackName || !targetPath) {
  console.error("Usage: npx tsx installer/install.ts <stack-name> <target-repo-path> [--force]");
  console.error("\nOptions:");
  console.error("  --force    Overwrite existing .claude/ and CLAUDE.md");
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const OUTPUT = join(ROOT, "output", stackName);
const TARGET = resolve(targetPath);

if (!existsSync(TARGET)) {
  console.error(`Error: Target path "${TARGET}" does not exist.`);
  process.exit(1);
}

if (!statSync(TARGET).isDirectory()) {
  console.error(`Error: Target path "${TARGET}" is not a directory.`);
  process.exit(1);
}

// ─── Step 1: Ensure merge output exists ───────────────────────────────────────

if (!existsSync(OUTPUT)) {
  console.log(`Output for "${stackName}" not found. Running merge...`);
  const mergeScript = join(ROOT, "scaffolder", "merge.ts");
  try {
    execSync(`npx tsx "${mergeScript}" "${stackName}"`, {
      cwd: ROOT,
      stdio: "inherit",
    });
  } catch {
    console.error("Merge failed. Cannot proceed with install.");
    process.exit(1);
  }
}

if (!existsSync(OUTPUT)) {
  console.error(`Error: Merge output not found at ${OUTPUT}`);
  process.exit(1);
}

// ─── Step 2: Check for existing installation ──────────────────────────────────

const targetDotclaude = join(TARGET, ".claude");
const targetClaudeMd = join(TARGET, "CLAUDE.md");

if (!force) {
  if (existsSync(targetDotclaude)) {
    console.error(`Error: ${targetDotclaude} already exists.`);
    console.error("Use --force to overwrite, or remove it manually first.");
    process.exit(1);
  }
  if (existsSync(targetClaudeMd)) {
    console.error(`Error: ${targetClaudeMd} already exists.`);
    console.error("Use --force to overwrite, or remove it manually first.");
    process.exit(1);
  }
}

// ─── Step 3: Install ──────────────────────────────────────────────────────────

// Copy .claude/ directory
const outputDotclaude = join(OUTPUT, ".claude");
if (existsSync(outputDotclaude)) {
  console.log(`Installing .claude/ → ${targetDotclaude}`);
  cpSync(outputDotclaude, targetDotclaude, { recursive: true });
}

// Copy CLAUDE.md
const outputClaudeMd = join(OUTPUT, "CLAUDE.md");
if (existsSync(outputClaudeMd)) {
  console.log(`Installing CLAUDE.md → ${targetClaudeMd}`);
  cpSync(outputClaudeMd, targetClaudeMd);
}

// Copy CLAUDE.local.md.example
const outputClaudeLocal = join(OUTPUT, "CLAUDE.local.md.example");
const targetClaudeLocal = join(TARGET, "CLAUDE.local.md.example");
if (existsSync(outputClaudeLocal)) {
  cpSync(outputClaudeLocal, targetClaudeLocal);
}

// ─── Step 4: Create .claude/.gitignore ────────────────────────────────────────

const gitignorePath = join(targetDotclaude, ".gitignore");
if (!existsSync(gitignorePath)) {
  writeFileSync(
    gitignorePath,
    `# Local settings (secrets, vault paths)
settings.local.json

# Memory (symlinked to Obsidian vault or local)
memory/

# Temp files
*.tmp
*.log
`
  );
}

// ─── Step 5: Make hooks executable ────────────────────────────────────────────

const hooksDir = join(targetDotclaude, "hooks");
if (existsSync(hooksDir)) {
  try {
    execSync(`chmod +x "${hooksDir}"/*.sh`, { stdio: "ignore" });
  } catch {
    // Non-fatal — may not have .sh files or chmod may fail on some systems
  }
}

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`
Installation complete!

Next steps:
  1. cd ${TARGET}
  2. Open Claude Code in this directory
  3. Run /setupdotclaude to personalize the configuration for this specific project
  4. (Optional) Run /setup-obsidian to connect your Obsidian vault

Files installed:
  ${targetDotclaude}/          — skills, agents, hooks, rules, settings
  ${targetClaudeMd}     — project instructions
  ${targetClaudeLocal}  — local overrides template (rename to CLAUDE.local.md)
`);
