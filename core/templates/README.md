# Core Templates — Reference

## Hook Composition Rule

Stack hooks **EXTEND** core hooks — they do not replace them.

When `merge.ts` finds both `core/hooks/<name>.sh` and `stacks/<stack>/hooks/<name>.sh`:
- The output hook contains the core content FIRST (including its shebang and all checks)
- Then the stack-specific content is appended below a separator comment
- Both blocks run sequentially — if either exits non-zero, the hook blocks the action

**What this means for stack authors:**
- Do NOT duplicate core checks (`.env`, `.git/`, `secrets/`, `.claude/hooks/`) in your stack hook
- Your stack hook should ONLY contain stack-specific additions (lockfiles, build output dirs, etc.)
- The shebang (`#!/bin/bash`) in your stack hook is stripped during merge (core's shebang is used)

If only the stack has a hook (no core equivalent), it's copied as-is.
If only core has a hook (stack doesn't override), it's copied as-is.

## alwaysApply Criteria

A rule file gets `alwaysApply: true` ONLY if BOTH:
- It applies to literally every edit regardless of file type (agent behavior, commit rules, stop conditions), AND
- It is under 50 lines

Everything else uses `paths:` scoping. Language-specific or file-type-specific rules must be path-scoped.
