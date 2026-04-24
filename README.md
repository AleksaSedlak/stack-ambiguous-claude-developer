# stack-agnostic-dotclaude

A template system for generating stack-specific Claude Code configurations. Takes the pain out of setting up `.claude/` for new projects.

## Architecture

```
core/               — Stack-agnostic foundation (identical across all stacks)
  skills/           — Universal skills: explain, context, setup-obsidian, pr-review, new-stack
  hooks/            — Universal hooks: protect-files, scan-secrets, block-dangerous-commands, session-start
  rules/            — Autonomous mode rules: pre-commit, stop conditions, recovery, commit/branch, dependencies
  templates/        ��� Structural templates + stack-manifest.json for validation

stacks/             — Completed stack-specific configurations
  nestjs/           — NestJS (with detect.ts + apply.ts automation)
  phoenix/          — Phoenix/Elixir
  generic-ts/       — Generic TypeScript/JavaScript (fallback)
  python-fastapi/   — Python/FastAPI

scaffolder/         — Tools for creating new stacks
  scaffold.ts       — Creates folder structure with example-template stubs
  research.ts       — Fetches docs + exemplar repos as structured markdown
  merge.ts          — Combines core/ + stack → installable output (hooks are composed, not replaced)
  validate-stack.ts — Validates a stack against stack-manifest.json

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

**Recommended: Use the `/new-stack` skill inside Claude Code** — it orchestrates the entire workflow interactively (scaffold → research → fill sections with approval → validate → parity test).

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
# 6. Validate the stack
npx tsx scaffolder/validate-stack.ts stacks/nextjs

# 7. Merge and inspect
npx tsx scaffolder/merge.ts nextjs
ls output/nextjs/
```

### Validate a stack

```bash
npx tsx scaffolder/validate-stack.ts stacks/<name>
```

Checks: required files exist, no forbidden markers remain, required sections present in rules, minimum line counts met, valid JSON, hooks pass `bash -n`, no unlinked TODOs. Exits non-zero on any failure.

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
| `core/` | Universal skills, hooks, autonomous-mode rules | Always overwritten on update |
| `stacks/<name>/` | Framework-specific rules, agents, skills, hooks | Agents/hooks overwritten; rules show diff |
| Target repo `.claude/` | Personalized via detect/apply | `*.local.*` files never touched |

### Hook composition

When both core and stack have a same-named hook (e.g., `protect-files.sh`), they are **composed** — core content runs first, then stack additions are appended. This means a stack that forgets to protect `.env` still inherits that protection from core. Stack hooks should only contain stack-specific additions, never duplicate core checks.

### Merge rules

When `merge.ts` combines core + stack:
- `core/skills/` and `core/hooks/` are copied first (baseline)
- `stacks/<name>/hooks/` are **composed** with core hooks (not replaced)
- `stacks/<name>/skills/` override same-named core skills
- `stacks/<name>/agents/`, `rules/`, `scripts/` are copied directly
- `CLAUDE.md` and `settings.json` come from the stack

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
| `python-fastapi` | Complete | Manual setup via /setupdotclaude |

## Core skills

| Skill | Purpose |
|-------|---------|
| `/new-stack` | Interactive workflow to create a new stack (scaffold → research → fill → validate → parity test) |
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

Stacks extend these with ecosystem-specific protections (lockfiles, build output, package publish, formatter). Hook composition ensures core protections are never lost.

## Core rules (autonomous mode)

These rules live in `core/rules/` and govern agent behavior for prompt-to-commit workflows:

| Rule | Purpose |
|------|---------|
| `autonomous-commit.md` | 7-point pre-commit checklist (typecheck, lint, tests, build, debug code, diff size, TODOs) |
| `stop-conditions.md` | 11 conditions that force the agent to halt and ask |
| `recovery.md` | What to do when tests fail, fixes regress, or the approach is wrong |
| `commit-and-branch.md` | Commit hygiene, branch naming, destructive operation guardrails |
| `context-discipline.md` | Re-read discipline for long sessions + determinism rules |
| `dependencies.md` | When dependency changes need confirmation |
| `autonomous-mode-requirements.md` | Required hooks + conditions for autonomous mode |

## Token economy

Rules use `alwaysApply: true` only when they govern agent behavior on every action (commit rules, stop conditions). Language-specific and file-type-specific rules use `paths:` scoping so they're only loaded when relevant files are being edited.

| Scope | What's loaded | When |
|-------|--------------|------|
| Core rules (autonomous mode) | ~190 lines | Every turn |
| Stack `alwaysApply` rules | ~30 lines | Every turn |
| Path-scoped rules (TypeScript, testing, security, etc.) | 50-130 lines each | Only when editing matching files |

## Quality enforcement

New stacks are validated against `core/templates/stack-manifest.json` via `validate-stack.ts`:

- **Required files**: CLAUDE.md, settings.json, 4+ rules, 2+ agents, 4 hooks
- **Required sections**: security must have Input Validation, Injection Prevention, Authentication, Secrets (etc.)
- **Minimum line counts**: security ≥60, code-quality ≥40, agents ≥30
- **Forbidden content**: no leftover `TODO_ADD_GLOB` or `<!-- EXAMPLE —` markers
- **Structural checks**: valid JSON, valid bash syntax, no string comments in arrays

The `/new-stack` skill also requires a parity test: install into an exemplar repo, run `/setupdotclaude`, verify rule globs match real files, and confirm `/pr-review` produces findings.

## Requirements

- Node.js 20+
- `git` CLI (for research.ts exemplar analysis)
- `jq` (for hooks at runtime)
