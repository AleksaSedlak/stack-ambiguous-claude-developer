#!/usr/bin/env node
/**
 * research.ts — Research assistant for filling stack templates.
 *
 * This is NOT a standalone generator. It's a helper that:
 * 1. Reads stack.config.json for doc URLs and exemplar repos
 * 2. Fetches each source
 * 3. Outputs structured findings for the human to review
 *
 * Designed to be called by a Claude Code skill (/new-stack) which handles
 * the interactive review loop. Can also be run standalone to dump findings.
 *
 * Usage:
 *   npx tsx scaffolder/research.ts <stack-name> [--section <section>]
 *
 * Sections: architecture, commands, rules, agents, hooks, all
 *
 * What it does:
 * - Reads stack.config.json
 * - For each doc URL: fetches and extracts relevant sections
 * - For each exemplar repo: clones (shallow) and analyzes structure
 * - Outputs a research report organized by section
 *
 * NOTE: This requires network access and `git` CLI.
 * It does NOT write to the stack files — that's the human's job.
 *
 * Zero runtime dependencies — uses only Node built-ins.
 */

import { existsSync, readFileSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const stackName = args.find((a) => !a.startsWith("--"));
const sectionIdx = args.indexOf("--section");
const section = sectionIdx !== -1 ? args[sectionIdx + 1] : "all";

if (!stackName) {
  console.error("Usage: npx tsx scaffolder/research.ts <stack-name> [--section <section>]");
  console.error("Sections: architecture, commands, rules, agents, hooks, all");
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const STACK_DIR = join(ROOT, "stacks", stackName);
const CONFIG_PATH = join(STACK_DIR, "stack.config.json");
const TEMP_DIR = join(ROOT, ".research-tmp", stackName);

if (!existsSync(CONFIG_PATH)) {
  console.error(`Error: No stack.config.json found at ${CONFIG_PATH}`);
  console.error("Run scaffold.ts first, then fill in stack.config.json.");
  process.exit(1);
}

// ─── Load Config ──────────────────────────────────────────────────────────────

interface StackConfig {
  name: string;
  language: string;
  ecosystem: string;
  docs: string[];
  exemplars: string[];
}

const config: StackConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

// Filter out comment lines
const docUrls = config.docs.filter((d) => !d.startsWith("//"));
const exemplarRepos = config.exemplars.filter((e) => !e.startsWith("//"));

if (docUrls.length === 0 && exemplarRepos.length === 0) {
  console.error("Error: stack.config.json has no doc URLs or exemplar repos configured.");
  console.error("Fill in the 'docs' and 'exemplars' arrays first.");
  process.exit(1);
}

// ─── Fetch Docs ───────────────────────────────────────────────────────────────

interface DocResult {
  url: string;
  title: string;
  content: string;
  error?: string;
}

function fetchDoc(url: string): DocResult {
  try {
    // Use curl for fetching — universally available
    const raw = execSync(
      `curl -sL --max-time 15 -H "Accept: text/html" "${url}"`,
      { encoding: "utf-8", maxBuffer: 5 * 1024 * 1024 }
    );

    // Basic HTML → text extraction (strip tags, decode entities)
    const text = raw
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 8000); // Cap at 8k chars

    // Try to extract title
    const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : url;

    return { url, title, content: text };
  } catch (e: any) {
    return { url, title: url, content: "", error: e.message?.slice(0, 200) };
  }
}

// ─── Clone Exemplars ──────────────────────────────────────────────────────────

interface RepoResult {
  repo: string;
  tree: string;
  configFiles: string[];
  srcStructure: string;
  error?: string;
}

function analyzeExemplar(repoRef: string): RepoResult {
  // repoRef can be: "owner/repo", "owner/repo/path", "https://github.com/owner/repo"
  let repoUrl: string;
  let subpath = "";

  if (repoRef.startsWith("http")) {
    repoUrl = repoRef;
  } else {
    const parts = repoRef.split("/");
    if (parts.length >= 2) {
      repoUrl = `https://github.com/${parts[0]}/${parts[1]}`;
      subpath = parts.slice(2).join("/");
    } else {
      return { repo: repoRef, tree: "", configFiles: [], srcStructure: "", error: "Invalid repo reference" };
    }
  }

  const cloneDir = join(TEMP_DIR, repoRef.replace(/[/\\:]/g, "_"));

  try {
    mkdirSync(TEMP_DIR, { recursive: true });

    // Shallow clone (depth 1, no blobs for speed)
    if (!existsSync(cloneDir)) {
      execSync(`git clone --depth 1 --filter=blob:none --sparse "${repoUrl}.git" "${cloneDir}" 2>/dev/null`, {
        timeout: 30000,
      });
    }

    const targetDir = subpath ? join(cloneDir, subpath) : cloneDir;

    // Get tree (top 2 levels)
    const tree = execSync(`find "${targetDir}" -maxdepth 3 -type f | head -100`, {
      encoding: "utf-8",
      timeout: 5000,
    })
      .split("\n")
      .map((f) => f.replace(targetDir + "/", ""))
      .filter((f) => !f.startsWith(".git/") && f.trim())
      .join("\n");

    // Find config files
    const configPatterns = [
      "package.json",
      "tsconfig.json",
      "next.config.*",
      "svelte.config.*",
      "vite.config.*",
      "nest-cli.json",
      "mix.exs",
      "Cargo.toml",
      "go.mod",
      "pyproject.toml",
      "Dockerfile",
      "docker-compose.*",
    ];

    const configFiles: string[] = [];
    for (const pattern of configPatterns) {
      try {
        const found = execSync(`find "${targetDir}" -maxdepth 2 -name "${pattern}" -type f 2>/dev/null`, {
          encoding: "utf-8",
          timeout: 3000,
        }).trim();
        if (found) configFiles.push(...found.split("\n").map((f) => f.replace(targetDir + "/", "")));
      } catch {}
    }

    // Get src directory structure
    const srcDir = existsSync(join(targetDir, "src"))
      ? join(targetDir, "src")
      : existsSync(join(targetDir, "app"))
        ? join(targetDir, "app")
        : existsSync(join(targetDir, "lib"))
          ? join(targetDir, "lib")
          : targetDir;

    const srcStructure = execSync(`find "${srcDir}" -maxdepth 3 -type d | head -40`, {
      encoding: "utf-8",
      timeout: 3000,
    })
      .split("\n")
      .map((d) => d.replace(targetDir + "/", ""))
      .filter((d) => d.trim() && !d.includes("node_modules") && !d.includes(".git"))
      .join("\n");

    return { repo: repoRef, tree, configFiles, srcStructure };
  } catch (e: any) {
    return { repo: repoRef, tree: "", configFiles: [], srcStructure: "", error: e.message?.slice(0, 200) };
  }
}

// ─── Run Research ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(60)}`);
console.log(`RESEARCH REPORT: ${stackName}`);
console.log(`${"═".repeat(60)}\n`);

// Fetch docs
if (docUrls.length > 0) {
  console.log(`\n## Documentation Sources\n`);
  for (const url of docUrls) {
    console.log(`Fetching: ${url}...`);
    const result = fetchDoc(url);
    if (result.error) {
      console.log(`  ERROR: ${result.error}\n`);
    } else {
      console.log(`  Title: ${result.title}`);
      console.log(`  Content (first 2000 chars):\n`);
      console.log(`  ${result.content.slice(0, 2000).replace(/\n/g, "\n  ")}\n`);
      console.log(`  ---\n`);
    }
  }
}

// Analyze exemplars
if (exemplarRepos.length > 0) {
  console.log(`\n## Exemplar Repositories\n`);
  for (const repo of exemplarRepos) {
    console.log(`Analyzing: ${repo}...`);
    const result = analyzeExemplar(repo);
    if (result.error) {
      console.log(`  ERROR: ${result.error}\n`);
    } else {
      console.log(`  Config files: ${result.configFiles.join(", ") || "none found"}`);
      console.log(`\n  Source structure:`);
      console.log(`  ${result.srcStructure.replace(/\n/g, "\n  ")}`);
      console.log(`\n  File tree (top entries):`);
      console.log(`  ${result.tree.split("\n").slice(0, 30).join("\n  ")}`);
      console.log(`\n  ---\n`);
    }
  }
}

// ─── Cleanup ──────────────────────────────────────────────────────────────────

// Don't auto-clean — user might want to inspect cloned repos
console.log(`\nResearch artifacts saved in: ${TEMP_DIR}`);
console.log(`Run: rm -rf "${TEMP_DIR}" to clean up.\n`);

console.log(`${"═".repeat(60)}`);
console.log(`Use these findings to fill the TODO markers in stacks/${stackName}/`);
console.log(`${"═".repeat(60)}\n`);
