# Project Instructions

This is the stack-agnostic-dotclaude template system. It produces `.claude/` configurations for different tech stacks.

## Context vault

On session start, read `~/Obsidian/stack-agnostic-dotclaude/00-index.md` for full project context, current state, and open questions. The vault holds narrative/decisions — code stays in this repo.

## Quick reference

- `npx tsx scaffolder/scaffold.ts <name>` — create a new stack
- `npx tsx scaffolder/merge.ts <name>` — combine core + stack → output
- `npx tsx scaffolder/validate-stack.ts stacks/<name>` — validate a stack
- `npx tsx installer/install.ts <name> <path>` — install into a project
- `npx tsx installer/update.ts <name> <path>` — pull updates into installed project
