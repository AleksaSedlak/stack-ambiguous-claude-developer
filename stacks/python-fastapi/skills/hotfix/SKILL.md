---
name: hotfix
description: Emergency production fix — create hotfix branch, minimal change, critical tests only, ship fast
argument-hint: "[issue number, error message, or description of production problem]"
disable-model-invocation: true
allowed-tools:
  - Bash(git *)
  - Bash(npm test*)
  - Bash(pnpm test*)
  - Bash(yarn test*)
  - Bash(bun test*)
  - Bash(npx tsc*)
  - Bash(pnpm tsc*)
  - Bash(npm run*)
  - Bash(pnpm run*)
  - Bash(yarn run*)
  - Read
  - Glob
  - Grep
  - Edit
  - Write
---

Emergency production fix. Speed matters — make the smallest correct change, verify it works, and ship.

## Step 1: Create Hotfix Branch

- Determine the production branch (`main` or `master` — check with `git remote show origin` or `git symbolic-ref refs/remotes/origin/HEAD`). Some teams use `production` or `release/*`.
- Stash any uncommitted work if needed
- Create and switch to `hotfix/<short-description>` branch from the production branch
- **ASK the user to confirm** the branch name before creating

## Step 2: Understand the Problem

- If `$ARGUMENTS` is a Jira ticket (e.g., `PROJ-123`): fetch it from the Jira MCP server if configured. If no Jira MCP is available, ask the user to paste the ticket description.
- If it's an error message, stack trace, or Sentry link: search the codebase for the relevant code. Map transpiled `dist/` / `.next/` stacks back to source via source maps.
- Identify the root cause — trace from symptom to source. Don't guess.
- **Briefly state** what you found and your proposed fix to the user

## Step 3: Fix — Minimal Change Only

- Make the smallest change that correctly fixes the issue
- **Do NOT**:
  - Refactor surrounding code
  - Add new features
  - Clean up unrelated issues
  - Change formatting or style (the formatter will run on save, but don't manually tidy up other files)
  - Upgrade dependencies
  - Add comments beyond what's necessary to understand the fix
  - Widen types to `any` to bypass a type error — fix the underlying issue
- If the fix requires more than ~50 lines changed, warn the user — this may not be a hotfix

## Step 4: Verify

- Run only the tests directly relevant to the changed code (not the full suite):
  - Vitest / Jest: `vitest run path/to/file.test.ts` or `jest path/to/file.test.ts`
  - Node built-in: `node --test path/to/file.test.js`
- Type-check: `tsc --noEmit` (fast on small diffs)
- If there's a way to reproduce the original error, verify it's fixed
- **ASK the user** if they want to run any additional verification (smoke test, `next build`, staging deploy, etc.)

## Step 5: Ship

- Stage only the fix files (never stage secrets, lockfiles, build output)
- Draft a commit message: `hotfix: <short description>` with a brief explanation
- **ASK the user to confirm** the commit message
- Push with `git push -u origin hotfix/<description>`
- Extract the remote URL: `git remote get-url origin`
- Convert to a browser-friendly PR creation URL targeting the production branch
- Present to the user:
  > Branch pushed. Create your PR here: `<url>`
  >
  > **Suggested title**: `[HOTFIX] <description>`
  >
  > **Suggested body**: what broke, what caused it, what this fixes, blast radius (which users / endpoints affected)

## Rules

- NEVER skip confirmation steps
- NEVER force-push
- NEVER commit secrets or unrelated changes
- NEVER refactor — this is a hotfix, not a cleanup
- NEVER run `npm publish` / `pnpm publish` / deploys directly — prepare the PR, humans ship the deploy
- If the user says "skip" at any step, skip it and move to the next
- If the fix turns out to be complex, tell the user and suggest a regular branch instead
