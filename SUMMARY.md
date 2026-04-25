# What This Is

A template system that produces ready-to-use `.claude/` configurations for different tech stacks. You run a command, it outputs a folder you drop into any project, and Claude Code immediately has stack-appropriate rules, skills, hooks, and agents.

# The Problem It Solves

Setting up Claude Code properly for a project takes hours: writing rules for the framework's patterns, creating safety hooks, configuring permissions, building review agents. This work is 70% identical across projects using the same stack. This repo centralizes that work so you do it once per stack and install everywhere.

# How It Works

## Three layers

```
core/          → Stuff that's the same for every stack (13 skills with methodology, safety hooks, autonomous rules)
stacks/<name>/ → Stuff specific to a framework (STACK-FLAVOR.md, rules, agents, hooks, setupdotclaude)
tooling        → Scripts that combine the above and install into target repos
```

## The STACK-FLAVOR split

Skills are separated into methodology + ecosystem flavor:

- `core/skills/debug-fix/SKILL.md` — "how to investigate a bug" (same for every stack)
- `stacks/nestjs/skills/debug-fix/STACK-FLAVOR.md` — "NestJS-specific: circular DI, missing @Injectable, stale dist/"

5 skills have flavor files (debug-fix, test-writer, tdd, refactor, review). The schema at `core/templates/skill-flavor-schema.json` defines required sections with search terms for research mapping.

## The flow

```
1. You pick a stack (nestjs, go, nextjs, etc.)
2. scaffold.ts creates stacks/<name>/ with stubs + STACK-FLAVOR.md from schema
3. Fill stack.config.json with doc URLs + docsRepo (GitHub raw markdown)
4. research.ts --mapped fetches docs and produces pre-matched excerpts per STACK-FLAVOR section
5. /new-stack guides two-pass fill: Pass 1 from research only (GAPs marked), Pass 2 human reviews gaps
6. validate-stack.ts checks 10 criteria including STACK-FLAVOR presence + sections
7. merge.ts combines core/ + that stack into one output folder
8. install.ts copies that folder into your project as .claude/ + CLAUDE.md
9. You run /setupdotclaude inside the project to personalize
```

## Creating new stacks

```
1. scaffold.ts creates stacks/<name>/ with TODO-marked skeleton + STACK-FLAVOR stubs
   (or --from <existing> copies rules/agents/hooks but generates fresh STACK-FLAVOR stubs)
2. Fill stack.config.json with doc URLs, docsRepo, and exemplar repos
3. research.ts --mapped fetches sources and maps to STACK-FLAVOR sections
4. /new-stack walks through filling rules, agents, hooks, and STACK-FLAVOR (two-pass)
5. validate-stack.ts confirms everything passes (10 checks)
6. Parity test: install into a real repo, run /setupdotclaude, run /pr-review
```

# What Each Piece Does

| Component | Purpose |
|-----------|---------|
| `core/skills/` | 13 skills: 8 workflow methodology (debug-fix, test-writer, tdd, refactor, ship, hotfix, review, init) + 5 utility (explain, context, setup-obsidian, pr-review, new-stack) |
| `core/hooks/` | 4 safety hooks: block dangerous commands, protect sensitive files, scan for secrets, inject session context |
| `core/rules/` | 7 autonomous-mode rules: pre-commit, stop conditions, recovery, commit/branch, context discipline, dependencies, mode requirements |
| `core/templates/` | stack-manifest.json (validation), skill-flavor-schema.json (STACK-FLAVOR structure + searchTerms) |
| `stacks/*/skills/*/STACK-FLAVOR.md` | Ecosystem-specific tools, bug patterns, commands for 5 skills |
| `stacks/*/rules/` | Framework-specific coding rules (api, security, testing, error handling, database, code quality) |
| `stacks/*/agents/` | Specialist code reviewers (security, performance, code quality, docs) tuned to that stack |
| `stacks/*/hooks/` | Stack-specific hooks (format-on-save with the right formatter, warn-large-files with the right dirs) |
| `stacks/*/skills/setupdotclaude/` | 100% stack-specific detection + customization skill |
| `scaffolder/scaffold.ts` | Creates new stack skeleton with stubs + STACK-FLAVOR.md from schema |
| `scaffolder/research.ts` | Fetches docs (docsRepo or URLs) + clones exemplar repos. --mapped for pre-matched output |
| `scaffolder/merge.ts` | Combines core + stack into installable output (hooks composed, skills overlaid) |
| `scaffolder/validate-stack.ts` | 10-check validation against manifest + flavor schema |
| `installer/install.ts` | Copies merged output into a target project |
| `installer/update.ts` | Pulls updates without overwriting customizations |

# Current State

**2 stacks:** NestJS (complete, 60/60 validation), Go (STACK-FLAVOR complete via pipeline, rules/agents/hooks are stubs).

**Tested workflows:** scaffold (fresh + --from), research (docsRepo + URLs + --mapped), merge, install, validate, two-pass fill.

**Key innovation:** The two-pass research-driven fill pipeline ensures content comes from actual documentation, not LLM priors. GAPs are structurally visible.

# Where to Look for Improvement Opportunities

1. **Build remaining stacks** — nextjs, react-native, phoenix, generic-ts, python-fastapi all need rebuilding via the pipeline
2. **Parity test** — install a stack into a real project, run /setupdotclaude + /pr-review
3. **Research quality for obscure stacks** — test with sparse-docs frameworks (Gleam, Zig)
4. **Autonomous mode thresholds** — are the stop-and-ask numbers right? Needs real sessions
5. **The agents** — do pr-review agents catch real issues or produce noise?
6. **workflow-commands.json** — setupdotclaude generates it but untested in practice
