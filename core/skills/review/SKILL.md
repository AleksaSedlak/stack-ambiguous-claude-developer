---
name: review
description: Self-review all changes before pushing — catch issues before they reach the PR
argument-hint: "[optional: focus area like 'security' or 'performance']"
disable-model-invocation: true
---

Review all uncommitted and staged changes. Report findings — do NOT auto-fix unless asked.

## Step 1: Gather the Diff

- Run `git diff` (unstaged) and `git diff --cached` (staged) to get all changes
- Run `git log main..HEAD --oneline` to see commits already on this branch
- If there are no changes, tell the user and stop

## Step 2: Debug Leftovers

For each changed file, check for:
- Debug statements: `console.log`, `debugger`, `print`, `IO.inspect`, `dbg!`, `binding.pry`, `pp`, `var_dump`
- TODOs without issue links (bare `TODO` or `FIXME` with no `#123` reference)
- Commented-out code (more than 2 consecutive commented lines that look like code, not docs)
- Temporary workarounds (hardcoded values, `// HACK`, `// TEMP`)

## Step 3: Contract Check

- Did any public API signatures change? (exported functions, route paths, HTTP methods, response shapes, event schemas)
- If yes: is this intentional and backwards-compatible?
- Did any database schema change? Is there a migration?
- Did any configuration shape change? Are defaults provided?

## Step 4: Run Verification

Run the project's verification commands (see STACK-FLAVOR.md → Verification Commands):
- Type-checker
- Linter
- Full test suite
- Build (if the changed code is in the build path)

Report any failures.

## Step 5: Stack-Specific Patterns

Check for issues specific to this stack's ecosystem (see STACK-FLAVOR.md → Stack-Specific Review Patterns).

## Step 6: Commit Hygiene

- Is the diff one logical change? If it mixes a feature with a refactor or a bug fix, suggest splitting.
- Is the diff under 300 lines (excluding generated files/lockfiles)? If larger, suggest splitting into stacked commits.
- Does the commit message follow the repo's convention? (Check `git log --oneline -10` for style.)
- Are there files that shouldn't be committed? (secrets, build output, lockfile changes not tied to intentional dep changes)

## Step 7: Security

- Any new environment variables? Are they in `.env.example`?
- Any hardcoded strings that look like secrets (API keys, tokens, passwords)?
- Any user input flowing to dangerous sinks (SQL, shell commands, innerHTML, eval, template rendering)?
- Any new dependencies added? Are they intentional?

## Output

Report findings in this format:

```
## Review Summary

**Files reviewed**: N files, M lines changed

### Issues Found
- [severity] file:line — description

### Checks Passed
- Type-check: pass/fail
- Lint: pass/fail
- Tests: pass/fail (N tests)
- Build: pass/fail/skipped

### Verdict
[Clean — ready to push / N issues to address before pushing]
```

If no issues found, say so clearly. Don't invent problems.
