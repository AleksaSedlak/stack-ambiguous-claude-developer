# Project Instructions

This is the stack-agnostic-dotclaude template system. It produces `.claude/` configurations for different tech stacks.

## Context vault

On session start, read `~/Obsidian/stack-agnostic-dotclaude/00-index.md` for full project context, current state, and open questions. The vault holds narrative/decisions — code stays in this repo.

## Quick reference

- `npx tsx scaffolder/scaffold.ts <name>` — create a new stack (fresh)
- `npx tsx scaffolder/scaffold.ts <name> --from <stack>` — create from existing (selective copy, fresh STACK-FLAVOR stubs)
- `npx tsx scaffolder/research.ts <name> --mapped` — research with pre-mapped output for fill step
- `npx tsx scaffolder/merge.ts <name>` — combine core + stack → output
- `npx tsx scaffolder/validate-stack.ts stacks/<name>` — validate (10 checks incl. STACK-FLAVOR)
- `npx tsx installer/install.ts <name> <path>` — install into a project
- `npx tsx installer/update.ts <name> <path>` — pull updates into installed project

## Key concepts

- **SKILL.md** (core) = stack-agnostic methodology. **STACK-FLAVOR.md** (stacks) = ecosystem-specific tools/patterns.
- **docsRepo** in stack.config.json fetches raw markdown from GitHub (bypasses SPA docs).
- **--mapped** flag produces research output pre-matched to STACK-FLAVOR sections via searchTerms.
- **Two-pass fill**: Pass 1 = research-only with GAP markers. Pass 2 = human reviews gaps.
