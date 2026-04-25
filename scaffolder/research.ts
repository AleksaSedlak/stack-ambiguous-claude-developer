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
 *   npx tsx scaffolder/research.ts <stack-name> [--section <filter>] [--max-chars <N>]
 *
 * Options:
 *   --section <filter>   Filter extracted content to headings matching <filter> (case-insensitive substring)
 *   --max-chars <N>      Max characters per doc page (default: 40000)
 *
 * What it does:
 * - Reads stack.config.json
 * - For each doc URL: fetches and converts to structured markdown
 * - For each exemplar repo: clones (shallow) and analyzes structure
 * - Outputs a research report organized by section
 *
 * NOTE: This requires network access and `git` CLI.
 * It does NOT write to the stack files — that's the human's job.
 *
 * Zero runtime dependencies — uses only Node built-ins.
 */

import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const stackName = args.find((a) => !a.startsWith("--"));
const sectionIdx = args.indexOf("--section");
const sectionFilter = sectionIdx !== -1 ? args[sectionIdx + 1] : null;
const mappedMode = args.includes("--mapped");
const maxCharsIdx = args.indexOf("--max-chars");
const MAX_CHARS =
  maxCharsIdx !== -1 ? parseInt(args[maxCharsIdx + 1], 10) : 40000;

if (!stackName) {
  console.error(
    "Usage: npx tsx scaffolder/research.ts <stack-name> [--section <filter>] [--max-chars <N>]",
  );
  console.error("\nOptions:");
  console.error(
    "  --section <filter>  Only include sections whose heading matches this substring",
  );
  console.error(
    "  --max-chars <N>     Max characters per doc page (default: 40000)",
  );
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
  docsRepo?: {
    repo: string;
    paths: string[];
    branch?: string;
  };
  exemplars: string[];
  sparsePaths?: string[];
}

const config: StackConfig = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));

// Filter out comment lines
const docUrls = config.docs.filter((d) => !d.startsWith("//"));
const exemplarRepos = config.exemplars.filter((e) => !e.startsWith("//"));

if (docUrls.length === 0 && exemplarRepos.length === 0) {
  console.error(
    "Error: stack.config.json has no doc URLs or exemplar repos configured.",
  );
  console.error("Fill in the 'docs' and 'exemplars' arrays first.");
  process.exit(1);
}

// ─── HTML → Markdown Conversion ──────────────────────────────────────────────

function htmlToMarkdown(html: string): string {
  // Remove non-content elements
  let s = html;
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "");
  s = s.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "");
  s = s.replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");
  s = s.replace(/<!--[\s\S]*?-->/g, "");

  // Try to extract just the main/article content if present
  const mainMatch =
    s.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
    s.match(/<article[^>]*>([\s\S]*?)<\/article>/i) ||
    s.match(/<div[^>]*class="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
  if (mainMatch) {
    s = mainMatch[1];
  }

  // Convert code blocks FIRST (before stripping other tags)
  // <pre><code>...</code></pre> → ```\n...\n```
  s = s.replace(
    /<pre[^>]*>\s*<code[^>]*(?:class="[^"]*language-(\w+)[^"]*")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_match, lang, code) => {
      const decoded = decodeEntities(code.trim());
      return `\n\`\`\`${lang || ""}\n${decoded}\n\`\`\`\n`;
    },
  );
  // <pre>...</pre> without <code>
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_match, code) => {
    const decoded = decodeEntities(code.replace(/<[^>]+>/g, "").trim());
    return `\n\`\`\`\n${decoded}\n\`\`\`\n`;
  });

  // Inline code: <code>...</code>
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_match, code) => {
    const decoded = decodeEntities(code.replace(/<[^>]+>/g, "")).trim();
    return decoded.includes("\n")
      ? `\`\`\`\n${decoded}\n\`\`\``
      : `\`${decoded}\``;
  });

  // Headings
  s = s.replace(
    /<h1[^>]*>([\s\S]*?)<\/h1>/gi,
    (_m, t) => `\n# ${stripTags(t).trim()}\n`,
  );
  s = s.replace(
    /<h2[^>]*>([\s\S]*?)<\/h2>/gi,
    (_m, t) => `\n## ${stripTags(t).trim()}\n`,
  );
  s = s.replace(
    /<h3[^>]*>([\s\S]*?)<\/h3>/gi,
    (_m, t) => `\n### ${stripTags(t).trim()}\n`,
  );
  s = s.replace(
    /<h4[^>]*>([\s\S]*?)<\/h4>/gi,
    (_m, t) => `\n#### ${stripTags(t).trim()}\n`,
  );
  s = s.replace(
    /<h5[^>]*>([\s\S]*?)<\/h5>/gi,
    (_m, t) => `\n##### ${stripTags(t).trim()}\n`,
  );
  s = s.replace(
    /<h6[^>]*>([\s\S]*?)<\/h6>/gi,
    (_m, t) => `\n###### ${stripTags(t).trim()}\n`,
  );

  // Lists
  s = s.replace(
    /<li[^>]*>([\s\S]*?)<\/li>/gi,
    (_m, content) => `- ${stripTags(content).trim()}\n`,
  );
  s = s.replace(/<\/?[uo]l[^>]*>/gi, "\n");

  // Tables (basic: preserve as markdown table)
  s = s.replace(/<table[^>]*>([\s\S]*?)<\/table>/gi, (_m, table) => {
    const rows: string[] = [];
    const rowMatches = table.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
    for (const row of rowMatches) {
      const cells = (row.match(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi) || []).map(
        (c) => stripTags(c.replace(/<\/?t[hd][^>]*>/gi, "")).trim(),
      );
      if (cells.length > 0) rows.push(`| ${cells.join(" | ")} |`);
      // Add separator after first row (header)
      if (rows.length === 1) {
        rows.push(`| ${cells.map(() => "---").join(" | ")} |`);
      }
    }
    return `\n${rows.join("\n")}\n`;
  });

  // Paragraphs and breaks
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(
    /<p[^>]*>([\s\S]*?)<\/p>/gi,
    (_m, content) => `\n${stripTags(content).trim()}\n`,
  );

  // Bold and italic
  s = s.replace(
    /<(strong|b)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, content) => `**${stripTags(content).trim()}**`,
  );
  s = s.replace(
    /<(em|i)[^>]*>([\s\S]*?)<\/\1>/gi,
    (_m, _t, content) => `*${stripTags(content).trim()}*`,
  );

  // Links
  s = s.replace(
    /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi,
    (_m, href, text) => {
      const linkText = stripTags(text).trim();
      return href.startsWith("#") ? linkText : `[${linkText}](${href})`;
    },
  );

  // Strip remaining HTML tags
  s = s.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  s = decodeEntities(s);

  // Clean up whitespace: collapse multiple blank lines to max 2
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();

  return s;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "");
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, n) =>
      String.fromCharCode(parseInt(n, 16)),
    );
}

// ─── Section Filtering ────────────────────────────────────────────────────────

function filterBySection(markdown: string, filter: string): string {
  const lines = markdown.split("\n");
  const result: string[] = [];
  let include = false;
  let currentLevel = 0;
  const filterLower = filter.toLowerCase();

  for (const line of lines) {
    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const title = headingMatch[2].toLowerCase();

      if (title.includes(filterLower)) {
        include = true;
        currentLevel = level;
        result.push(line);
      } else if (include && level <= currentLevel) {
        // We've hit a same-level or higher-level heading — stop including
        include = false;
      } else if (include) {
        // Sub-heading within matched section — keep
        result.push(line);
      }
    } else if (include) {
      result.push(line);
    }
  }

  return result.join("\n").trim();
}

// ─── MDX Stripping ──────────────────────────────────────────────────────────

function stripMdx(content: string): string {
  let s = content;

  // Extract title from frontmatter before stripping
  const frontmatterMatch = s.match(/^---\n([\s\S]*?)\n---/);
  let title = "";
  if (frontmatterMatch) {
    const titleMatch = frontmatterMatch[1].match(/title:\s*['"]?(.+?)['"]?\s*$/m);
    if (titleMatch) title = titleMatch[1];
    s = s.replace(/^---\n[\s\S]*?\n---\n?/, "");
  }

  // Remove import statements (at top of file or anywhere)
  s = s.replace(/^import\s+.*$/gm, "");

  // Remove export statements (but not code inside ``` blocks)
  s = s.replace(/^export\s+(?:default\s+)?(?:const|let|var|function|class)\s+.*$/gm, "");

  // Strip JSX/MDX component tags but keep inner text content
  // Self-closing tags: <Component /> or <Component prop="val" />
  s = s.replace(/<[A-Z]\w*[^>]*\/>/g, "");
  // Opening + closing tags: <Component>...</Component> — keep inner content
  s = s.replace(/<[A-Z]\w*[^>]*>/g, "");
  s = s.replace(/<\/[A-Z]\w*>/g, "");

  // Clean up extra blank lines
  s = s.replace(/\n{3,}/g, "\n\n");
  s = s.trim();

  // Prepend title as heading if extracted from frontmatter
  if (title) {
    s = `# ${title}\n\n${s}`;
  }

  return s;
}

// ─── Fetch Docs from GitHub Repo ────────────────────────────────────────────

function fetchDocsFromRepo(docsRepo: NonNullable<StackConfig["docsRepo"]>): DocResult[] {
  const repoUrl = `https://github.com/${docsRepo.repo}`;
  const branch = docsRepo.branch || "main";
  const cloneDir = join(TEMP_DIR, `docs-repo-${docsRepo.repo.replace(/[/\\:]/g, "_")}`);

  try {
    mkdirSync(TEMP_DIR, { recursive: true });

    if (!existsSync(cloneDir)) {
      // Shallow clone with sparse checkout
      execSync(
        `git clone --depth 1 --branch "${branch}" --filter=blob:none --sparse "${repoUrl}.git" "${cloneDir}" 2>/dev/null`,
        { timeout: 60000 },
      );

      if (docsRepo.paths.length > 0) {
        // sparse-checkout expects directories, not glob patterns
        // Extract directory prefixes from paths (e.g., "content/**/*.md" → "content")
        const dirs = [...new Set(docsRepo.paths.map((p) => p.split("/")[0]))];
        const sparseArgs = dirs.map((d) => `"${d}"`).join(" ");
        execSync(`cd "${cloneDir}" && git sparse-checkout set ${sparseArgs}`, {
          timeout: 15000,
        });
      }
    }

    // Find all .md and .mdx files
    const files = execSync(
      `find "${cloneDir}" -type f \\( -name "*.md" -o -name "*.mdx" \\) -not -path "*/.git/*" | sort`,
      { encoding: "utf-8", timeout: 10000 },
    )
      .trim()
      .split("\n")
      .filter((f) => f.trim());

    if (files.length === 0) {
      process.stderr.write(`  Warning: no .md/.mdx files found in ${docsRepo.repo}\n`);
      return [];
    }

    process.stderr.write(`  Found ${files.length} doc files in ${docsRepo.repo}\n`);

    const results: DocResult[] = [];
    for (const filePath of files) {
      const relativePath = filePath.replace(cloneDir + "/", "");
      const raw = readFileSync(filePath, "utf-8");

      // Strip MDX syntax, extract title
      let markdown = filePath.endsWith(".mdx") ? stripMdx(raw) : raw;

      // Use filename path as fallback title
      const title = relativePath.replace(/\.(md|mdx)$/, "").replace(/\//g, " / ");

      // Apply section filter
      if (sectionFilter) {
        markdown = filterBySection(markdown, sectionFilter);
        if (!markdown) continue; // skip files with no matching sections
      }

      // Apply character cap
      if (markdown.length > MAX_CHARS) {
        markdown = markdown.slice(0, MAX_CHARS) + `\n\n--- (truncated at ${MAX_CHARS} chars) ---`;
      }

      // Skip nearly empty files
      if (markdown.replace(/\s/g, "").length < 50) continue;

      results.push({ url: `${repoUrl}/blob/${branch}/${relativePath}`, title, markdown });
    }

    return results;
  } catch (e: any) {
    process.stderr.write(`  Warning: failed to fetch docs from ${docsRepo.repo}: ${e.message?.slice(0, 200)}\n`);
    return [];
  }
}

// ─── Fetch Docs via curl ────────────────────────────────────────────────────

interface DocResult {
  url: string;
  title: string;
  markdown: string;
  error?: string;
}

function fetchDoc(url: string): DocResult {
  try {
    const raw = execSync(
      `curl -sL --max-time 30 -H "Accept: text/html" "${url}"`,
      { encoding: "utf-8", maxBuffer: 10 * 1024 * 1024 },
    );

    // Extract title
    const titleMatch = raw.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? decodeEntities(titleMatch[1]).trim() : url;

    // Convert HTML → structured markdown
    let markdown = htmlToMarkdown(raw);

    // Apply section filter if specified
    if (sectionFilter) {
      markdown = filterBySection(markdown, sectionFilter);
      if (!markdown) {
        return {
          url,
          title,
          markdown: `(No sections matching "${sectionFilter}" found)`,
        };
      }
    }

    // Apply character cap
    if (markdown.length > MAX_CHARS) {
      markdown =
        markdown.slice(0, MAX_CHARS) +
        `\n\n--- (truncated at ${MAX_CHARS} chars) ---`;
    }

    return { url, title, markdown };
  } catch (e: any) {
    return { url, title: url, markdown: "", error: e.message?.slice(0, 200) };
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
      return {
        repo: repoRef,
        tree: "",
        configFiles: [],
        srcStructure: "",
        error: "Invalid repo reference",
      };
    }
  }

  const cloneDir = join(TEMP_DIR, repoRef.replace(/[/\\:]/g, "_"));

  try {
    mkdirSync(TEMP_DIR, { recursive: true });

    if (!existsSync(cloneDir)) {
      if (config.sparsePaths && config.sparsePaths.length > 0) {
        // Sparse clone — only checkout configured paths (fast for large repos)
        execSync(
          `git clone --depth 1 --filter=blob:none --sparse "${repoUrl}.git" "${cloneDir}" 2>/dev/null`,
          {
            timeout: 60000,
          },
        );
        // sparse-checkout expects directories, not glob patterns or bare filenames
        // Extract top-level directory names; skip bare filenames (no /)
        const dirs = [...new Set(
          config.sparsePaths
            .filter((p) => p.includes("/"))
            .map((p) => p.split("/")[0])
        )];
        if (dirs.length > 0) {
          const sparseArgs = dirs.map((d) => `"${d}"`).join(" ");
          execSync(`cd "${cloneDir}" && git sparse-checkout set ${sparseArgs}`, {
            timeout: 15000,
          });
        }
      } else {
        // Full shallow clone (slower but guaranteed to have files)
        process.stderr.write(
          `  (no sparsePaths configured — doing full shallow clone, may be slow)\n`,
        );
        execSync(
          `git clone --depth 1 "${repoUrl}.git" "${cloneDir}" 2>/dev/null`,
          {
            timeout: 60000,
          },
        );
      }
    }

    const targetDir = subpath ? join(cloneDir, subpath) : cloneDir;

    if (!existsSync(targetDir)) {
      return {
        repo: repoRef,
        tree: "",
        configFiles: [],
        srcStructure: "",
        error: `Subpath "${subpath}" not found in clone`,
      };
    }

    // Verify at least one file exists in the working tree
    const fileCheck = execSync(
      `find "${targetDir}" -maxdepth 3 -type f -not -path '*/.git/*' | head -1`,
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    ).trim();
    if (!fileCheck) {
      return {
        repo: repoRef,
        tree: "",
        configFiles: [],
        srcStructure: "",
        error:
          "Clone appears empty — no files found after checkout. Check sparsePaths configuration.",
      };
    }

    // Get tree (top 3 levels)
    const tree = execSync(
      `find "${targetDir}" -maxdepth 3 -type f | head -100`,
      {
        encoding: "utf-8",
        timeout: 5000,
      },
    )
      .split("\n")
      .map((f) => f.replace(targetDir + "/", ""))
      .filter(
        (f) => !f.startsWith(".git/") && !f.startsWith(".git") && f.trim(),
      )
      .join("\n");

    // Verify files actually exist
    if (!tree.trim()) {
      return {
        repo: repoRef,
        tree: "",
        configFiles: [],
        srcStructure: "",
        error: "Clone appears empty — no files found",
      };
    }

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
        const found = execSync(
          `find "${targetDir}" -maxdepth 2 -name "${pattern}" -type f 2>/dev/null`,
          {
            encoding: "utf-8",
            timeout: 3000,
          },
        ).trim();
        if (found)
          configFiles.push(
            ...found.split("\n").map((f) => f.replace(targetDir + "/", "")),
          );
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

    const srcStructure = execSync(
      `find "${srcDir}" -maxdepth 3 -type d | head -40`,
      {
        encoding: "utf-8",
        timeout: 3000,
      },
    )
      .split("\n")
      .map((d) => d.replace(targetDir + "/", ""))
      .filter(
        (d) => d.trim() && !d.includes("node_modules") && !d.includes(".git"),
      )
      .join("\n");

    return { repo: repoRef, tree, configFiles, srcStructure };
  } catch (e: any) {
    return {
      repo: repoRef,
      tree: "",
      configFiles: [],
      srcStructure: "",
      error: e.message?.slice(0, 200),
    };
  }
}

// ─── Map Research to STACK-FLAVOR Sections ──────────────────────────────────

interface FlavorSection {
  heading: string;
  guide: string;
  searchTerms: string[];
}

interface FlavorSkill {
  requiresFlavor: boolean;
  sections?: FlavorSection[];
}

interface FlavorSchema {
  skills: Record<string, FlavorSkill>;
}

interface MappedExcerpt {
  source: string;
  relevance: number;
  excerpt: string;
}

interface MappedSection {
  skill: string;
  heading: string;
  guide: string;
  excerpts: MappedExcerpt[];
}

function scoreDoc(doc: DocResult, searchTerms: string[]): number {
  const text = (doc.title + "\n" + doc.markdown.slice(0, 1500)).toLowerCase();
  let score = 0;
  for (const term of searchTerms) {
    const termLower = term.toLowerCase();
    // Count occurrences in title (weighted 3x) and content
    const titleHits = (doc.title.toLowerCase().match(new RegExp(termLower, "g")) || []).length;
    const contentHits = (text.match(new RegExp(termLower, "g")) || []).length;
    score += titleHits * 3 + contentHits;
  }
  return score;
}

function extractExcerpt(doc: DocResult, maxChars: number = 2000): string {
  // Take the first meaningful content (skip frontmatter-like lines)
  const lines = doc.markdown.split("\n");
  const meaningful: string[] = [];
  let chars = 0;
  for (const line of lines) {
    if (chars > maxChars) break;
    meaningful.push(line);
    chars += line.length;
  }
  return meaningful.join("\n");
}

function mapResearchToSections(docs: DocResult[]): MappedSection[] {
  const schemaPath = join(ROOT, "core", "templates", "skill-flavor-schema.json");
  if (!existsSync(schemaPath)) {
    process.stderr.write("  Warning: skill-flavor-schema.json not found — cannot map research.\n");
    return [];
  }

  const schema: FlavorSchema = JSON.parse(readFileSync(schemaPath, "utf-8"));
  const mapped: MappedSection[] = [];

  for (const [skillName, skillConfig] of Object.entries(schema.skills)) {
    if (!skillConfig.requiresFlavor || !skillConfig.sections) continue;

    for (const section of skillConfig.sections) {
      // Score every doc against this section's search terms
      const scored = docs
        .map((doc) => ({
          source: doc.title || doc.url,
          relevance: scoreDoc(doc, section.searchTerms),
          excerpt: extractExcerpt(doc),
        }))
        .filter((s) => s.relevance > 0)
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 5); // top 5 most relevant docs per section

      mapped.push({
        skill: skillName,
        heading: section.heading,
        guide: section.guide,
        excerpts: scored,
      });
    }
  }

  return mapped;
}

function formatMappedOutput(mapped: MappedSection[]): string {
  const lines: string[] = [];
  lines.push("# Pre-Mapped Research for STACK-FLAVOR Fill\n");
  lines.push("Each section below shows the most relevant research excerpts for a specific");
  lines.push("STACK-FLAVOR.md section. Use ONLY these excerpts for Pass 1 (research-sourced content).");
  lines.push("Sections with no excerpts are marked as GAPs for Pass 2.\n");

  let currentSkill = "";
  for (const section of mapped) {
    if (section.skill !== currentSkill) {
      currentSkill = section.skill;
      lines.push(`\n${"=".repeat(60)}`);
      lines.push(`## Skill: ${section.skill}`);
      lines.push(`${"=".repeat(60)}\n`);
    }

    lines.push(`### ${section.heading}`);
    lines.push(`*Guide: ${section.guide}*\n`);

    if (section.excerpts.length === 0) {
      lines.push("**<!-- GAP: No research excerpts found for this section. -->**");
      lines.push("This section will need manual fill or additional research sources in Pass 2.\n");
    } else {
      lines.push(`*${section.excerpts.length} relevant excerpt(s):*\n`);
      for (const excerpt of section.excerpts) {
        lines.push(`#### Source: ${excerpt.source} (relevance: ${excerpt.relevance})`);
        lines.push("");
        // Indent the excerpt as a blockquote for clarity
        const excerptLines = excerpt.excerpt.split("\n").slice(0, 40);
        for (const el of excerptLines) {
          lines.push(`> ${el}`);
        }
        lines.push("");
      }
    }
    lines.push("---\n");
  }

  return lines.join("\n");
}

// ─── Run Research ─────────────────────────────────────────────────────────────

const output: string[] = [];

output.push(`# Research Report: ${stackName}`);
output.push(`\nConfig: ${CONFIG_PATH}`);
output.push(`Max chars per page: ${MAX_CHARS}`);
if (sectionFilter) output.push(`Section filter: "${sectionFilter}"`);
output.push("");

// Fetch docs — try docsRepo (raw markdown) first, fall back to curl
// Collect all docs for potential mapping in --mapped mode
const allDocResults: DocResult[] = [];
let docsFromRepo = false;

if (config.docsRepo && config.docsRepo.repo) {
  process.stderr.write(`\nFetching docs from GitHub repo: ${config.docsRepo.repo}...\n`);
  const repoResults = fetchDocsFromRepo(config.docsRepo);

  if (repoResults.length > 0) {
    docsFromRepo = true;
    allDocResults.push(...repoResults);
    output.push(`\n## Documentation Sources (from ${config.docsRepo.repo})\n`);
    for (const result of repoResults) {
      output.push(`### ${result.title}`);
      output.push(`*Source: ${result.url}*\n`);
      output.push(result.markdown);
      output.push("\n---\n");
    }
    process.stderr.write(`  Fetched ${repoResults.length} doc files from repo.\n`);
  } else {
    process.stderr.write(`  No content from docs repo — falling back to URL fetching.\n`);
  }
}

if (docUrls.length > 0) {
  output.push(`\n## Documentation Sources (via URL fetch${docsFromRepo ? " — supplemental" : ""})\n`);
  for (const url of docUrls) {
    process.stderr.write(`Fetching: ${url}...\n`);
    const result = fetchDoc(url);
    if (result.error) {
      output.push(`### Source: ${url}\n\n**ERROR:** ${result.error}\n`);
    } else if (result.markdown.replace(/\s/g, "").length < 200) {
      output.push(`### Source: ${url}`);
      output.push(`**WARNING:** Page returned very little content (${result.markdown.length} chars). This is likely an SPA-rendered page.`);
      output.push(`Consider adding a \`docsRepo\` field to stack.config.json pointing to the docs source repo on GitHub.\n`);
      output.push(result.markdown);
      output.push("\n---\n");
    } else {
      allDocResults.push(result);
      output.push(`### Source: ${url}`);
      output.push(`**Title:** ${result.title}\n`);
      output.push(result.markdown);
      output.push("\n---\n");
    }
  }
}

// Analyze exemplars
if (exemplarRepos.length > 0) {
  output.push(`\n## Exemplar Repositories\n`);
  for (const repo of exemplarRepos) {
    process.stderr.write(`Analyzing: ${repo}...\n`);
    const result = analyzeExemplar(repo);
    if (result.error) {
      output.push(`### ${repo}\n\n**ERROR:** ${result.error}\n`);
    } else {
      output.push(`### ${repo}\n`);
      output.push(
        `**Config files:** ${result.configFiles.join(", ") || "none found"}\n`,
      );
      output.push(`**Source structure:**`);
      output.push("```");
      output.push(result.srcStructure);
      output.push("```\n");
      output.push(`**File tree (top entries):**`);
      output.push("```");
      output.push(result.tree.split("\n").slice(0, 40).join("\n"));
      output.push("```\n");
      output.push("---\n");
    }
  }
}

// Write output
const report = output.join("\n");
mkdirSync(TEMP_DIR, { recursive: true });

if (mappedMode) {
  process.stderr.write(`\nMapping ${allDocResults.length} docs to STACK-FLAVOR sections...\n`);
  const mapped = mapResearchToSections(allDocResults);
  const mappedReport = formatMappedOutput(mapped);

  // Save both reports
  const mappedPath = join(TEMP_DIR, "research-mapped.md");
  writeFileSync(mappedPath, mappedReport);
  writeFileSync(join(TEMP_DIR, "research-report.md"), report);

  console.log(mappedReport);
  process.stderr.write(`\nMapped report saved to: ${mappedPath}\n`);
  process.stderr.write(`Full report saved to: ${join(TEMP_DIR, "research-report.md")}\n`);
} else {
  console.log(report);
  const reportPath = join(TEMP_DIR, "research-report.md");
  writeFileSync(reportPath, report);
  process.stderr.write(`\nReport saved to: ${reportPath}\n`);
  process.stderr.write(`Tip: use --mapped to get pre-mapped output for STACK-FLAVOR fill.\n`);
}

process.stderr.write(`Research artifacts in: ${TEMP_DIR}\n`);
process.stderr.write(`Run: rm -rf "${TEMP_DIR}" to clean up.\n`);
