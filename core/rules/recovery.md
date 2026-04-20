---
alwaysApply: true
description: What to do when tests fail, when a fix regresses, or when the agent realizes its approach is wrong.
---

# Recovery Protocol

## When tests fail after an edit

1. Re-read the failing test AND the file you changed (do not rely on cached understanding)
2. Determine if your edit caused the failure or it was pre-existing: `git stash && <test command> && git stash pop`
3. If your edit caused it: fix it. Max 3 attempts. On attempt 4, STOP and ask.
4. If pre-existing: note it to the user in your next message, but do not block your commit on it

## When a fix breaks something else (regression)

1. Run `git diff` to see all changes since last green state
2. Identify the most recent edit likely to have caused the regression
3. Revert that edit (`git checkout -- <file>`) and re-run tests
4. If green, try a different approach for the original problem
5. If still red, the regression was elsewhere — widen the bisect

## When you realize the approach is wrong after 5+ edits

1. STOP. Do not make "just one more fix."
2. `git stash` all uncommitted changes
3. Write a short message to the user: what you tried, why it didn't work, what you'd try instead, whether to continue
4. Wait for confirmation before starting over

## Never

- Never delete a test because it fails. If a test is wrong, say so and propose a fix to the test with rationale — then wait.
- Never add `.skip`, `.only`, or equivalent to bypass a red test without user confirmation.
- Never commit with `--no-verify` or bypass hooks.
