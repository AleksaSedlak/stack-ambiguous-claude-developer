# What This Is

A template system that produces ready-to-use `.claude/` configurations for different tech stacks. You run a command, it outputs a folder you drop into any project, and Claude Code immediately has stack-appropriate rules, skills, hooks, and agents.

# The Problem It Solves

Setting up Claude Code properly for a project takes hours: writing rules for the framework's patterns, creating safety hooks, configuring permissions, building review agents. This work is 70% identical across projects using the same stack. This repo centralizes that work so you do it once per stack and install everywhere.

# How It Works

## Three layers

```
core/          → Stuff that's the same for every stack (safety hooks, Obsidian integration, /explain, /pr-review)
stacks/<name>/ → Stuff specific to a framework (NestJS rules, Phoenix agents, TS testing patterns)
tooling        → Scripts that combine the above and install into target repos
```

## The flow

```
1. You pick a stack (nestjs, generic-ts, phoenix)
2. merge.ts combines core/ + that stack into one output folder
3. install.ts copies that folder into your project as .claude/ + CLAUDE.md
4. You run /setupdotclaude inside the project to personalize (detects your DB, monorepo, package manager, etc.)
```

## Creating new stacks

```
1. scaffold.ts creates stacks/<name>/ with TODO-marked skeleton files
2. You fill stack.config.json with doc URLs + exemplar repos
3. research.ts fetches those sources and dumps findings
4. You fill the TODOs section-by-section (or use /new-stack skill for interactive guidance)
```

# What Each Piece Does

| Component | Purpose |
|-----------|---------|
| `core/skills/` | 5 skills that work identically everywhere: explain, context, setup-obsidian, pr-review, new-stack |
| `core/hooks/` | 4 safety hooks: block dangerous commands, protect sensitive files, scan for secrets, inject session context |
| `core/templates/` | Structural templates showing the shape of CLAUDE.md, settings.json, and rule files |
| `stacks/*/rules/` | Framework-specific coding rules (api patterns, security, testing, error handling, database) |
| `stacks/*/agents/` | Specialist code reviewers (security, performance, runtime, docs) tuned to that stack |
| `stacks/*/skills/` | Stack-specific skills (debug-fix, ship, hotfix, tdd, refactor, test-writer, setupdotclaude) |
| `stacks/*/hooks/` | Stack-specific hooks (format-on-save with the right formatter, warn-large-files with the right dirs) |
| `stacks/*/scripts/` | detect.ts + apply.ts (NestJS only currently) — scans a repo and fills CLAUDE.md markers |
| `scaffolder/merge.ts` | Combines core + stack into installable output |
| `scaffolder/scaffold.ts` | Creates new stack skeleton with TODOs |
| `scaffolder/research.ts` | Fetches docs + clones exemplar repos for analysis |
| `installer/install.ts` | Copies merged output into a target project |
| `installer/update.ts` | Pulls updates into already-installed projects without overwriting customizations |

# Current State

**3 complete stacks:** NestJS (most mature, has auto-detection), Phoenix/Elixir, generic TypeScript/JavaScript.

**Tested workflows:** merge, install, scaffold, update (with dry-run).

**Not yet validated:** Creating a 4th stack end-to-end using the scaffold → research → fill pipeline. This is the next real test.

# Where to Look for Improvement Opportunities

1. **The rules themselves** — Are they specific enough to change AI behavior, or vague enough to be ignored? Do they contradict each other? Are important patterns missing for each stack?

2. **The skills** — Do debug-fix, ship, hotfix, tdd, refactor, test-writer actually produce good workflows, or are they over-prescriptive in ways that fight how Claude naturally works?

3. **The agents** — Are the review agents (code-reviewer, security-reviewer, performance-reviewer, runtime-reviewer) catching real issues when used via /pr-review, or producing noise?

4. **The hooks** — Are protect-files.sh and block-dangerous-commands.sh blocking things that should be allowed? Missing things that should be blocked? Is format-on-save reliable across formatters?

5. **The detection pipeline (NestJS)** — Does detect.ts correctly identify databases, communication patterns, monorepo structure in real projects? Does apply.ts fill CLAUDE.md markers correctly?

6. **The update mechanism** — Is the split between "overwrite" (skills/hooks/agents) and "show diff" (rules/CLAUDE.md) the right boundary? Should anything move between those categories?

7. **The scaffold output** — When you run scaffold.ts for a new stack, are the TODO stubs guiding you toward good content, or are they just empty placeholders that don't help?

8. **Cross-stack consistency** — Do the same concepts (error handling, security, testing) get expressed at the same quality level across stacks, or is NestJS significantly better than the others?

9. **Token cost** — Are there rules/agents/skills that cost tokens every turn (via `alwaysApply: true` or being loaded into context) without proportional value?

10. **The core/stack boundary** — Are things in core that should be in stacks (too specific)? Are things duplicated across stacks that should be in core (too repetitive)?
