#!/usr/bin/env node
/**
 * validate-stack.ts — Validates a stack against core/templates/stack-manifest.json.
 *
 * Usage:
 *   npx tsx scaffolder/validate-stack.ts stacks/<name>
 *
 * Checks:
 * 1. Required files exist
 * 2. No forbidden content markers remain
 * 3. Required sections present in rule files
 * 4. Minimum line counts met
 * 5. settings.json is valid JSON
 * 6. Hooks pass bash -n syntax check
 * 7. No TODOs in rule/agent files (without issue references)
 * 8. settings.json has no string comments in arrays
 *
 * Exits 0 if all pass, 1 otherwise.
 * Zero dependencies — uses only Node built-ins.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve, relative, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI ──────────────────────────────────────────────────────────────────────

const stackPath = process.argv[2];

if (!stackPath) {
  console.error("Usage: npx tsx scaffolder/validate-stack.ts stacks/<name>");
  process.exit(1);
}

const ROOT = resolve(__dirname, "..");
const STACK_DIR = resolve(stackPath);
const MANIFEST_PATH = join(ROOT, "core", "templates", "stack-manifest.json");

if (!existsSync(STACK_DIR)) {
  console.error(`Error: Stack path "${STACK_DIR}" does not exist.`);
  process.exit(1);
}

if (!existsSync(MANIFEST_PATH)) {
  console.error(`Error: Manifest not found at ${MANIFEST_PATH}`);
  process.exit(1);
}

// ─── Load Manifest ────────────────────────────────────────────────────────────

interface Manifest {
  requiredFiles: string[];
  minimumRuleSections: Record<string, string[]>;
  minimumLineCounts: Record<string, number>;
  forbiddenContent: string[];
}

const manifest: Manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));

// ─── Results Tracking ─────────────────────────────────────────────────────────

let totalChecks = 0;
let passedChecks = 0;
const failures: string[] = [];

function pass(msg: string): void {
  totalChecks++;
  passedChecks++;
  console.log(`  ✓ PASS: ${msg}`);
}

function fail(msg: string): void {
  totalChecks++;
  failures.push(msg);
  console.log(`  ✗ FAIL: ${msg}`);
}

// ─── Check 1: Required files exist ───────────────────────────────────────────

console.log("\n─── Check 1: Required files ───");
for (const file of manifest.requiredFiles) {
  const fullPath = join(STACK_DIR, file);
  if (existsSync(fullPath)) {
    pass(file);
  } else {
    fail(`Missing required file: ${file}`);
  }
}

// ─── Check 2: No forbidden content ───────────────────────────────────────────

console.log("\n─── Check 2: Forbidden content ───");
let forbiddenFound = false;

function scanDir(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== ".git" && entry.name !== "node_modules") {
        scanDir(fullPath);
      }
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".json") || entry.name.endsWith(".sh")) {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        for (const forbidden of manifest.forbiddenContent) {
          if (lines[i].includes(forbidden)) {
            fail(`${relative(STACK_DIR, fullPath)}:${i + 1} contains "${forbidden}"`);
            forbiddenFound = true;
          }
        }
      }
    }
  }
}

scanDir(STACK_DIR);
if (!forbiddenFound) {
  pass("No forbidden content found");
}

// ─── Check 3: Required sections present ──────────────────────────────────────

console.log("\n─── Check 3: Required sections ───");
for (const [filePath, requiredSections] of Object.entries(manifest.minimumRuleSections)) {
  const fullPath = join(STACK_DIR, filePath);
  if (!existsSync(fullPath)) {
    fail(`Cannot check sections — ${filePath} does not exist`);
    continue;
  }
  const content = readFileSync(fullPath, "utf-8").toLowerCase();
  for (const section of requiredSections) {
    // Match ## heading (case-insensitive)
    const pattern = `## ${section.toLowerCase()}`;
    if (content.includes(pattern)) {
      pass(`${filePath} has section "## ${section}"`);
    } else {
      fail(`${filePath} missing required section "## ${section}"`);
    }
  }
}

// ─── Check 4: Minimum line counts ───────────────────────────────────────────

console.log("\n─── Check 4: Minimum line counts ───");
for (const [filePath, minLines] of Object.entries(manifest.minimumLineCounts)) {
  const fullPath = join(STACK_DIR, filePath);
  if (!existsSync(fullPath)) {
    fail(`Cannot check line count — ${filePath} does not exist`);
    continue;
  }
  const content = readFileSync(fullPath, "utf-8");
  // Count non-blank, non-comment-only lines
  const meaningfulLines = content.split("\n").filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("<!--") && trimmed !== "---";
  }).length;

  if (meaningfulLines >= minLines) {
    pass(`${filePath}: ${meaningfulLines} lines (minimum: ${minLines})`);
  } else {
    fail(`${filePath}: ${meaningfulLines} lines < minimum ${minLines}`);
  }
}

// ─── Check 5: settings.json valid JSON ───────────────────────────────────────

console.log("\n─── Check 5: settings.json valid JSON ───");
const settingsPath = join(STACK_DIR, "settings.json");
if (existsSync(settingsPath)) {
  try {
    JSON.parse(readFileSync(settingsPath, "utf-8"));
    pass("settings.json parses as valid JSON");
  } catch (e: any) {
    fail(`settings.json parse error: ${e.message}`);
  }
} else {
  fail("settings.json does not exist");
}

// ─── Check 6: Hooks pass bash -n ────────────────────────────────────────────

console.log("\n─── Check 6: Hook syntax ───");
const hooksDir = join(STACK_DIR, "hooks");
if (existsSync(hooksDir)) {
  for (const entry of readdirSync(hooksDir)) {
    if (entry.endsWith(".sh")) {
      const hookPath = join(hooksDir, entry);
      try {
        execSync(`bash -n "${hookPath}" 2>&1`, { encoding: "utf-8" });
        pass(`hooks/${entry} syntax OK`);
      } catch (e: any) {
        fail(`hooks/${entry} syntax error: ${e.stdout || e.message}`);
      }
    }
  }
} else {
  fail("hooks/ directory does not exist");
}

// ─── Check 7: No TODOs in rule/agent files ───────────────────────────────────

console.log("\n─── Check 7: No unlinked TODOs ───");
let todoFound = false;

function scanForTodos(dir: string): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      scanForTodos(fullPath);
    } else if (entry.name.endsWith(".md")) {
      const content = readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        // Match TODO not followed by a URL or issue reference (#NNN)
        if (/\bTODO\b/i.test(lines[i]) && !/#\d+/.test(lines[i]) && !/(https?:\/\/)/.test(lines[i])) {
          fail(`${relative(STACK_DIR, fullPath)}:${i + 1} has unlinked TODO: "${lines[i].trim().slice(0, 80)}"`);
          todoFound = true;
        }
      }
    }
  }
}

scanForTodos(join(STACK_DIR, "rules"));
scanForTodos(join(STACK_DIR, "agents"));
scanForTodos(join(STACK_DIR, "skills"));
if (!todoFound) {
  pass("No unlinked TODOs in rules/, agents/, or skills/");
}

// ─── Check 8: settings.json no string comments in arrays ─────────────────────

console.log("\n─── Check 8: No string comments in JSON arrays ───");
if (existsSync(settingsPath)) {
  try {
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    let commentFound = false;

    function walkArrays(obj: unknown, path: string): void {
      if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
          const item = obj[i];
          if (typeof item === "string" && (item.startsWith("//") || item.startsWith("#"))) {
            fail(`settings.json ${path}[${i}] is a comment string: "${item.slice(0, 60)}"`);
            commentFound = true;
          } else if (typeof item === "object" && item !== null) {
            walkArrays(item, `${path}[${i}]`);
          }
        }
      } else if (typeof obj === "object" && obj !== null) {
        for (const [key, value] of Object.entries(obj)) {
          walkArrays(value, `${path}.${key}`);
        }
      }
    }

    walkArrays(settings, "root");
    if (!commentFound) {
      pass("No string comments in JSON arrays");
    }
  } catch {
    // Already caught in Check 5
  }
}

// ─── Check 9: STACK-FLAVOR.md files exist for required skills ───────────────

console.log("\n─── Check 9: STACK-FLAVOR.md presence ───");
const flavorSchemaPath = join(ROOT, "core", "templates", "skill-flavor-schema.json");
if (existsSync(flavorSchemaPath)) {
  const flavorSchema = JSON.parse(readFileSync(flavorSchemaPath, "utf-8"));
  for (const [skillName, config] of Object.entries(flavorSchema.skills) as [string, any][]) {
    if (!config.requiresFlavor) continue;
    const flavorPath = join(STACK_DIR, "skills", skillName, "STACK-FLAVOR.md");
    if (existsSync(flavorPath)) {
      pass(`skills/${skillName}/STACK-FLAVOR.md exists`);
    } else {
      fail(`Missing required file: skills/${skillName}/STACK-FLAVOR.md`);
    }
  }
} else {
  fail("skill-flavor-schema.json not found — cannot check STACK-FLAVOR.md files");
}

// ─── Check 10: STACK-FLAVOR.md has required sections ────────────────────────

console.log("\n─── Check 10: STACK-FLAVOR.md sections ───");
if (existsSync(flavorSchemaPath)) {
  const flavorSchema = JSON.parse(readFileSync(flavorSchemaPath, "utf-8"));
  for (const [skillName, config] of Object.entries(flavorSchema.skills) as [string, any][]) {
    if (!config.requiresFlavor) continue;
    const flavorPath = join(STACK_DIR, "skills", skillName, "STACK-FLAVOR.md");
    if (!existsSync(flavorPath)) continue; // Already caught in Check 9
    const content = readFileSync(flavorPath, "utf-8").toLowerCase();
    for (const section of config.sections) {
      const pattern = `## ${section.heading.toLowerCase()}`;
      if (content.includes(pattern)) {
        pass(`skills/${skillName}/STACK-FLAVOR.md has section "## ${section.heading}"`);
      } else {
        fail(`skills/${skillName}/STACK-FLAVOR.md missing required section "## ${section.heading}"`);
      }
    }
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(50)}`);
console.log(`${passedChecks} of ${totalChecks} checks passed.`);
if (failures.length > 0) {
  console.log(`\n${failures.length} failure(s):`);
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("\nAll checks passed. Stack is valid.");
  process.exit(0);
}
