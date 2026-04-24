---
alwaysApply: true
description: Verification checklist the agent must pass before committing in autonomous mode.
---

# Pre-commit Verification

Before creating any commit, the agent MUST verify ALL of the following pass:

1. **Type check**: the stack's type-check command exits 0 (e.g. `tsc --noEmit`, `mix compile --warnings-as-errors`)
2. **Lint**: the stack's lint command exits 0 (warnings OK, errors not)
3. **Tests**: full test suite passes, not just the ones you touched
4. **Build** (if changed code is in the build path): build exits 0
5. **No leftover debug code**: grep staged files for `console.log`, `debugger`, `.only(`, `IO.inspect`, `dbg`, `binding.pry`
6. **Diff size sanity**: if staged diff exceeds 500 lines, split into multiple commits
7. **No new TODOs without issue links**: staged files must not contain `TODO` without a `#NNN` reference

If ANY check fails, fix it before committing. If a test failure cannot be fixed after 3 attempts, STOP and ask the user — do not commit with failing tests and do not disable the test.

The exact commands for this stack are defined in `.claude/workflow-commands.json` at stack install time (setupdotclaude fills them).
