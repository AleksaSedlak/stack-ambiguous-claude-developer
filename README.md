# stack-agnostic-dotclaude

A template system for generating stack-specific Claude Code configurations. Takes the pain out of setting up `.claude/` for new projects.

## Architecture

```
core/               — Stack-agnostic foundation (identical across all stacks)
  skills/           — 13 universal skills (methodology lives here, ecosystem flavor in stacks)
    debug-fix/      — Bug investigation workflow
    test-writer/    — Test generation workflow
    tdd/            — Test-driven development loop
    refactor/       — Safe refactoring workflow
    ship/           — Commit + push + PR workflow
    hotfix/         — Emergency production fix
    review/         — Self-review before pushing
    init/           — Bootstrap a new project
    new-stack/      — Interactive stack creation pipeline
    pr-review/      — Delegate code review to specialist agents
    explain/        — Explain code with diagrams
    context/        — Search Obsidian vault for notes
    setup-obsidian/ — Configure vault integration
  hooks/            — Universal hooks: protect-files, scan-secrets, block-dangerous-commands, session-start
  rules/            — Autonomous mode rules: pre-commit, stop conditions, recovery, commit/branch, dependencies
  templates/        — Structural templates, stack-manifest.json, skill-flavor-schema.json

stacks/             — Stack-specific configurations
  nestjs/           — NestJS (complete — 60/60 validation)
  go/               — Go (STACK-FLAVOR complete, rules/agents/hooks are scaffold stubs)

scaffolder/         — Tools for creating and validating stacks
  scaffold.ts       — Creates folder structure with stubs + STACK-FLAVOR.md from schema
  research.ts       — Fetches docs (GitHub repo or URLs) + exemplar repos, supports --mapped output
  merge.ts          — Combines core/ + stack → installable output (hooks composed, skills overlaid)
  validate-stack.ts — 10-check validation against stack-manifest.json + skill-flavor-schema.json

installer/          — Tools for installing into target repos
  install.ts        — Copies merged output to a project
  update.ts         — Pulls updates without clobbering customizations
```

## Quick Start

### Install an existing stack into a project

```bash
npx tsx scaffolder/merge.ts nestjs
npx tsx installer/install.ts nestjs /path/to/your/nestjs-project
```

Then open Claude Code in that project and run `/setupdotclaude` to personalize.

### Create a new stack

**Recommended: Use the `/new-stack` skill inside Claude Code** — it orchestrates the full pipeline interactively.

```
/new-stack nextjs
```

**Or manually via CLI:**

```bash
# 1. Scaffold the structure (fresh or from existing stack)
npx tsx scaffolder/scaffold.ts nextjs
npx tsx scaffolder/scaffold.ts sveltekit --from nestjs  # copies rules/agents/hooks, generates fresh STACK-FLAVOR stubs

# 2. Fill stack.config.json with doc URLs, docsRepo, and exemplar repos

# 3. Run research with --mapped for pre-matched output
npx tsx scaffolder/research.ts nextjs --mapped

# 4. Fill STACK-FLAVOR.md files using the mapped research (two-pass)
#    Pass 1: research-sourced content only, GAP markers for uncovered sections
#    Pass 2: review gaps, fill from general knowledge or add research sources

# 5. Fill rules, agents, hooks, CLAUDE.md, setupdotclaude

# 6. Validate
npx tsx scaffolder/validate-stack.ts stacks/nextjs

# 7. Merge and inspect
npx tsx scaffolder/merge.ts nextjs
```

## How Skills Work: Methodology + Flavor

Skills are split into two files:

| File | Lives in | Content | Example |
|------|----------|---------|---------|
| `SKILL.md` | `core/skills/` | Stack-agnostic methodology (workflow steps, decision framework) | "Trace backwards from the symptom" |
| `STACK-FLAVOR.md` | `stacks/<name>/skills/` | Ecosystem-specific tools, bug patterns, commands | "Run `go test -race ./...`" |

During `merge.ts`, core provides the SKILL.md and the stack provides the STACK-FLAVOR.md. The SKILL.md references STACK-FLAVOR.md for ecosystem-specific content.

**Which skills need STACK-FLAVOR.md:**

| Skill | Flavor? | Sections |
|-------|---------|----------|
| debug-fix | Yes | Reproduction Tools, Environment Checks, Common Bug Patterns, Verification Commands |
| test-writer | Yes | Framework Detection, Framework-Specific Test Patterns, Mocking Tools |
| tdd | Yes | Signature Examples, Validation Libraries |
| refactor | Yes | Verification Commands |
| review | Yes | Verification Commands, Stack-Specific Review Patterns |
| ship, hotfix, init | No | Methodology-only |
| setupdotclaude | No | 100% stack-specific (each stack writes its own SKILL.md) |

The schema defining required sections lives at `core/templates/skill-flavor-schema.json`.

## Research Pipeline

### The SPA docs problem

Many modern frameworks (NestJS, FastAPI, Next.js) have SPA-rendered docs. `curl` gets an empty HTML shell. The solution:

### docsRepo — fetch raw markdown from GitHub

Most framework docs are written in markdown and stored in GitHub repos. Add a `docsRepo` field to `stack.config.json`:

```json
{
  "docsRepo": {
    "repo": "nestjs/docs.nestjs.com",
    "paths": ["content/**/*.md"],
    "branch": "master"
  },
  "docs": [
    "https://some-server-rendered-page.com/docs"
  ]
}
```

- `docsRepo` is the primary source — clones the repo via sparse checkout, reads `.md`/`.mdx` files directly
- `docs` URLs are always fetched as supplemental sources (useful for gap-filling with additional research)
- If `docsRepo` is not configured, falls back to curl-only

### Pre-mapped research output

```bash
npx tsx scaffolder/research.ts <stack> --mapped
```

The `--mapped` flag reads `skill-flavor-schema.json` and produces output keyed by (skill, section) with the most relevant doc excerpts pre-matched via search terms. This is what the fill step consumes — targeted excerpts per section instead of 138 undifferentiated doc files.

### Two-pass fill

**Pass 1 (research-only):** Write content ONLY from the pre-mapped excerpts. Sections with no research coverage get `<!-- GAP -->` markers.

**Pass 2 (fill gaps):** The user reviews each GAP and chooses: fill from general knowledge (tagged), add more research sources and re-run, or skip.

This ensures content is research-driven and hallucination is visible.

## How the Layers Work

| Layer | What it contains | Update behavior |
|-------|-----------------|-----------------|
| `core/` | Universal skills (methodology), hooks, autonomous-mode rules | Always overwritten on update |
| `stacks/<name>/` | STACK-FLAVOR.md, rules, agents, hooks, setupdotclaude | Agents/hooks overwritten; rules show diff |
| Target repo `.claude/` | Personalized via /setupdotclaude | `*.local.*` files never touched |

### Hook composition

When both core and stack have a same-named hook (e.g., `protect-files.sh`), they are **composed** — core content runs first, then stack additions are appended. Stack hooks should only contain stack-specific additions.

### Scaffold `--from` behavior

When scaffolding from an existing stack (`--from generic-ts`):
- Rules, agents, hooks, settings.json, CLAUDE.md → copied as starting point
- Skills → **skipped** (SKILL.md comes from core, STACK-FLAVOR.md gets fresh TODO stubs)
- setupdotclaude → copied (it's 100% stack-specific, useful as reference)
- stack.config.json → reset to blank (new stack has different docs/exemplars)

## Validation

```bash
npx tsx scaffolder/validate-stack.ts stacks/<name>
```

10 checks against `stack-manifest.json` and `skill-flavor-schema.json`:

1. Required files exist (CLAUDE.md, settings.json, rules, agents, hooks, STACK-FLAVOR.md)
2. No forbidden content markers (`TODO_ADD_GLOB`, `<!-- EXAMPLE —`)
3. Required sections present in rule files
4. Minimum line counts met
5. `settings.json` is valid JSON
6. Hooks pass `bash -n` syntax check
7. No unlinked TODOs in rules/, agents/, or skills/
8. No string comments in JSON arrays
9. STACK-FLAVOR.md files exist for required skills
10. STACK-FLAVOR.md files have required sections per schema

## Core Rules (Autonomous Mode)

| Rule | Purpose |
|------|---------|
| `autonomous-commit.md` | 7-point pre-commit checklist (typecheck, lint, tests, build, debug code, diff size, TODOs) |
| `stop-conditions.md` | 11 conditions that force the agent to halt and ask |
| `recovery.md` | What to do when tests fail, fixes regress, or the approach is wrong |
| `commit-and-branch.md` | Commit hygiene, branch naming, destructive operation guardrails |
| `context-discipline.md` | Re-read discipline for long sessions + determinism rules |
| `dependencies.md` | When dependency changes need confirmation |
| `autonomous-mode-requirements.md` | Required hooks + conditions for autonomous mode |

## Token Economy

Rules use `alwaysApply: true` only when they govern agent behavior on every action. Language-specific and file-type-specific rules use `paths:` scoping.

| Scope | What's loaded | When |
|-------|--------------|------|
| Core rules (autonomous mode) | ~190 lines | Every turn |
| Stack `alwaysApply` rules | ~30 lines | Every turn |
| Path-scoped rules | 50-130 lines each | Only when editing matching files |

## Requirements

- Node.js 20+
- `git` CLI (for research.ts)
- `jq` (for hooks at runtime)
