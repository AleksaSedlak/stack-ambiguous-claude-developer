---
name: debug-fix
description: Find and fix a bug or issue — from any source (GitHub issue, error message, user report, or observed behavior)
argument-hint: "[issue number, error message, or description of the problem]"
disable-model-invocation: true
---

Find and fix the following issue:

**Problem**: $ARGUMENTS

## Step 1: Understand the Problem

Determine what kind of input this is:
- **Jira ticket** (e.g., `PROJ-123`) → fetch from the Jira MCP server if configured. If no Jira MCP is available, ask the user to paste the ticket description.
- **Error message / stack trace** → parse it for file, line, error class/name, and the call chain leading to it. For TS source maps, trace back to the `.ts/.tsx` origin, not the transpiled `.js`.
- **Description of behavior** → identify what's expected vs what's happening
- **URL / screenshot** → examine the referenced resource

If the problem is unclear, ask clarifying questions before proceeding.

## Step 2: Reproduce

- Find or write the simplest way to trigger the issue (a failing unit test, a `curl` / `fetch` script, a minimal script via `ts-node` / `tsx` / `node --loader`)
- Confirm you can reproduce it reliably
- If you can't reproduce:
  - **Environment-specific?** Check env vars, Node version (`node -v`, `.nvmrc`), OS, package manager (pnpm/npm/yarn/bun), database state, cache (`.next/`, `.turbo/`, `node_modules/.cache/`)
  - **Intermittent?** Likely async/timing — look for unawaited promises, race conditions, shared module-level state, order-dependent tests, event loop scheduling assumptions, flaky network mocks
  - **Build-time vs runtime?** Some issues only show in production builds. Try `next build && next start`, `vite build && vite preview`, or the project's equivalent.
  - **Already fixed?** Check `git log` for recent commits that mention the issue

## Step 3: Investigate

Follow this sequence — don't skip ahead to guessing:

1. **Locate the symptom**: which file and line produces the wrong output/error? If the stack points to `dist/` or `node_modules/`, map it back to source via source maps or the package's published code.
2. **Read the code path**: trace backwards from the symptom. What function called this? What data did it pass? Read each caller. Pay attention to `async`/`await` — a missing `await` often causes values to appear as pending promises.
3. **Check git history**: `git log --oneline -20 -- <file>` to see what recently changed in the affected files. `git log --all --grep="<keyword>"` to find related commits. `git blame <file>` on the suspect line.
4. **Narrow the scope**: use `git bisect` or targeted grep to identify when the behavior changed, or which input triggers it.
5. **Form a hypothesis**: "I think [X] is wrong because [evidence]."
6. **Verify the hypothesis**: add a targeted `console.log` / `debugger` / temporary test assertion that would confirm or deny it. Run it.
7. **If wrong, update**: don't keep guessing with the same hypothesis. Go back to step 2 and trace a different path.

Common TS/JS bug sources to check:
- **Floating promises** — a function returns a `Promise` but the caller doesn't `await` it
- **`undefined` vs `null`** — optional chaining (`?.`) coerces to `undefined`, JSON `null` stays `null`
- **Type coercion** — `==` vs `===`, `Boolean("false") === true`, `Number("")  === 0`
- **Mutation of shared state** — default parameter objects (`function f(x = [])` — careful, evaluated each call), module-scoped arrays/maps
- **Closures over loop variables** — `var` vs `let`, stale refs in `useEffect`
- **`this` binding** — arrow vs function, class methods used as callbacks
- **Wrong environment** — server vs client (Next.js `use server`/`use client`), Node vs browser globals
- **Stale cache** — `.next/`, `.turbo/`, `node_modules/.vite/`, the package manager's store

## Step 4: Fix

- Make the minimal change that fixes the root cause
- Don't patch symptoms — if a value is wrong, trace back to where it becomes wrong and fix it there
- Don't refactor surrounding code while fixing the bug
- Don't add defensive `?? fallback` or `?.` that masks the real problem — fix why the bad data exists
- Don't widen types to `any` to silence a compiler error — that hides the bug, not fixes it

## Step 5: Verify

- Write a test that reproduces the original bug and now passes with the fix
- Run related tests to check for regressions
- Run the project's lint + type-check: typically `tsc --noEmit` and one of:
  - Biome: `biome check .`
  - Prettier + ESLint: `prettier --check .` and `eslint .`
- Temporarily revert your fix and confirm the new test fails — this proves the test actually catches the bug

## Step 6: Wrap Up

- Create a branch if not already on one
- Stage only the relevant files (fix + test, nothing else — not the lockfile unless intentionally changed)
- Commit with a message that references the issue if one exists: `fix: <what was wrong and why> (#number)`
