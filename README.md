# stack-agnostic-dotclaude

A template system for generating stack-specific Claude Code configurations. Takes the pain out of setting up `.claude/` for new projects.

## Architecture

```
core/               — Stack-agnostic foundation (identical across all stacks)
  skills/           — Universal skills: explain, context, setup-obsidian, pr-review, new-stack
  hooks/            — Universal hooks: protect-files, scan-secrets, block-dangerous-commands, session-start
  templates/        — Structural templates showing what files each stack needs

stacks/             — Completed stack-specific configurations
  nestjs/           — NestJS (with detect.ts + apply.ts automation)
  phoenix/          — Phoenix/Elixir
  generic-ts/       — Generic TypeScript/JavaScript (fallback)

scaffolder/         — Tools for creating new stacks
  scaffold.ts       — Creates folder structure with TODO stubs
  research.ts       — Fetches docs + exemplar repos for filling TODOs
  merge.ts          — Combines core/ + stack → installable output

installer/          — Tools for installing into target repos
  install.ts        — Copies merged output to a project
  update.ts         — Pulls updates without clobbering customizations
```

## Quick Start

### Install an existing stack into a project

```bash
npx tsx installer/install.ts nestjs /path/to/your/nestjs-project
```

Then open Claude Code in that project and run `/setupdotclaude` to personalize.

### Create a new stack

**Recommended: Use the `/new-stack` skill inside Claude Code** — it orchestrates the entire workflow interactively (scaffold → research → fill sections with approval at each step).

```
/new-stack nextjs
```

**Or manually via CLI:**

```bash
# 1. Scaffold the structure
npx tsx scaffolder/scaffold.ts nextjs

# 2. (Optional) Copy from an existing stack as starting point
npx tsx scaffolder/scaffold.ts sveltekit --from generic-ts

# 3. Fill stack.config.json with doc URLs and exemplar repos
# 4. Run research to get findings
npx tsx scaffolder/research.ts nextjs

# 5. Fill the TODO markers in stacks/nextjs/ using the research findings
# 6. Test: merge and inspect
npx tsx scaffolder/merge.ts nextjs
ls output/nextjs/
```

### Update an installed project

```bash
# See what would change
npx tsx installer/update.ts nestjs /path/to/project --dry-run

# Apply updates (overwrites skills/hooks/agents, shows diffs for rules/CLAUDE.md)
npx tsx installer/update.ts nestjs /path/to/project
```

## How the layers work

| Layer | What it contains | Update behavior |
|-------|-----------------|-----------------|
| `core/` | Universal skills, hooks | Always overwritten on update |
| `stacks/<name>/` | Framework-specific rules, agents, skills, hooks | Agents/hooks overwritten; rules show diff |
| Target repo `.claude/` | Personalized via detect/apply | `*.local.*` files never touched |

### Merge rules

When `merge.ts` combines core + stack:
- `core/skills/` and `core/hooks/` are copied first (baseline)
- `stacks/<name>/skills/` and `stacks/<name>/hooks/` override same-named core files
- `stacks/<name>/agents/`, `rules/`, `scripts/` are copied directly
- `CLAUDE.md` and `settings.json` come from the stack

Stack files only need to contain what's different from core. If a stack doesn't override a core skill (e.g., `explain`), the core version is used automatically.

### Update rules

When `update.ts` syncs an installed project:
- Skills, hooks, agents → **overwritten** (meant to stay in sync)
- Rules, CLAUDE.md → **diff shown, not overwritten** (user may have customized)
- `settings.json` → **deep-merged** (preserves user additions)
- `*.local.*` files and extra local files → **never touched**

## Available stacks

| Stack | Status | Automation |
|-------|--------|-----------|
| `nestjs` | Complete | detect.ts + apply.ts (monorepo-aware) |
| `phoenix` | Complete | Manual setup via /setupdotclaude |
| `generic-ts` | Complete | Framework detection in /setupdotclaude |

## Core skills

| Skill | Purpose |
|-------|---------|
| `/new-stack` | Interactive workflow to create a new stack (scaffold → research → fill → validate) |
| `/explain` | Explain code with ASCII diagrams and mental models |
| `/context` | Search Obsidian vault for relevant notes |
| `/setup-obsidian` | Configure Obsidian vault integration |
| `/pr-review` | Delegate code review to specialist agents |

Stacks provide additional skills: `/debug-fix`, `/ship`, `/hotfix`, `/tdd`, `/refactor`, `/test-writer`, `/setupdotclaude`.

## Core hooks

| Hook | Trigger | Purpose |
|------|---------|---------|
| `protect-files.sh` | PreToolUse (Edit/Write) | Blocks .env, secrets, .git/, .claude/hooks/ |
| `scan-secrets.sh` | PreToolUse (Edit/Write) | Detects API keys, tokens, credentials in content |
| `block-dangerous-commands.sh` | PreToolUse (Bash) | Blocks push to main, force push, DROP TABLE, rm -rf / |
| `session-start.sh` | SessionStart | Injects git branch, last commit, uncommitted changes |

Stacks extend these with ecosystem-specific protections (lockfiles, build output, package publish, formatter).

## Requirements

- Node.js 20+
- `git` CLI (for research.ts exemplar analysis)
- `jq` (for hooks at runtime)
