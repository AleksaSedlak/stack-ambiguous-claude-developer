---
name: context
description: Search your Obsidian vault for relevant notes and bring them into context. Use when you need background on architecture decisions, debugging history, or project knowledge.
argument-hint: "<search keywords — e.g. 'auth architecture', 'prisma migration patterns'>"
disable-model-invocation: true
---

Search the Obsidian vault for notes relevant to: **$ARGUMENTS**

## Prerequisites

Read the user's `settings.local.json` (check `.claude/settings.local.json` in the project, then `~/.claude/settings.local.json` globally) and extract:
- `obsidianVaultPath` — the absolute path to the Obsidian vault
- `obsidianExclude` — array of folder names to skip (default: `["Daily Notes", "Journal", "Private"]`)

If `obsidianVaultPath` is not set, tell the user:
> Obsidian vault path is not configured. Run `/setup-obsidian` to set it up.

Then stop.

## Step 1: Search the vault

Run two parallel searches using the vault path:

**Content search** — use Grep to find notes containing the search keywords:
- Search path: the vault directory
- Pattern: the keywords from $ARGUMENTS (join with `|` for OR matching if multiple words)
- Glob filter: `*.md` only
- Exclude folders from `obsidianExclude` — skip any results whose path contains an excluded folder name
- Also skip any results inside `.obsidian/` or `.trash/` directories

**Filename search** — use Glob to find notes whose filenames match the keywords:
- Search path: the vault directory
- Pattern: `**/*<keyword>*.md` for each keyword

Combine results from both searches, deduplicate by file path.

## Step 2: Prioritize results

Sort matches into tiers:
1. **Current project notes** — files under `Claude/<current-project>/` in the vault (extract project name from the current working directory's folder name)
2. **Vault root notes** — files in the vault root or common folders (not under `Claude/`)
3. **Other project notes** — files under `Claude/<other-project>/`

Within each tier, rank by number of keyword matches (more matches = more relevant).

## Step 3: Read and present

Read the top 3-5 most relevant files (across all tiers).

Present results in this format:

```
Found N relevant notes for "<query>":

1. **<filename>** (<location: vault root | Claude/<project> | <folder>>)
   <first 2-3 sentences or the frontmatter description if present>

2. **<filename>** (<location>)
   <summary>

3. ...

Reading top matches for full context...
```

Then read each file fully (up to 200 lines per file). After reading, provide a synthesized summary of the relevant information — don't just dump file contents.

## Rules

- NEVER write to any file in the vault — this skill is read-only
- NEVER read files in excluded folders — respect the exclude list
- Skip binary files, images, PDFs — only read `.md` files
- If no results are found, say so clearly and suggest broadening the search terms
- If the vault path doesn't exist on disk, tell the user the path may be wrong and suggest re-running `/setup-obsidian`
