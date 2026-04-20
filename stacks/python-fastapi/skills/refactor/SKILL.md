---
name: refactor
description: Safely refactor code with test coverage as a safety net
argument-hint: "[target to refactor — file, function, or pattern]"
disable-model-invocation: true
---

Refactor `$ARGUMENTS` safely.

## Process

### 1. Understand the current state
- Read the code and its tests
- Identify what the code does, its callers, and its dependencies (use grep / find references)
- If there are no tests, WRITE TESTS FIRST — you need a safety net before changing anything
- Note the current type signatures — they are part of the contract

### 2. Plan the refactoring
- State what you're changing and why (clearer naming, reduced duplication, better structure, narrower types, removing `any`)
- List the specific transformations (extract function, inline variable, move module, rename, split file, introduce interface/type alias, replace callback with Promise, etc.)
- Check: does this change any external behavior? If yes, this isn't a refactor — reconsider.
- Check: does this change any public type signatures callers depend on? If yes, it's an API change, not a pure refactor — note that in the commit.

### 3. Make changes in small, testable steps
- One transformation at a time
- Run tests after EACH step — not at the end
- Run the type-checker (`tsc --noEmit`) after each step — TS compiler is an additional safety net
- If a test breaks or types no longer check, undo the last step and make a smaller change

### 4. Verify
- All existing tests pass
- `tsc --noEmit` passes (no new type errors introduced)
- Lint/format passes:
  - Biome: `biome check .`
  - Prettier + ESLint: `prettier --check .` and `eslint .`
- The public API hasn't changed (unless that was the explicit goal)
- The code is objectively simpler — fewer lines, fewer branches, clearer names, narrower types, fewer `any`/`unknown` escape hatches

## Rules
- If you can't run the tests, don't refactor
- Never mix refactoring with behavior changes in the same commit
- If the refactoring touches many files (10+) or crosses module boundaries, break it into multiple commits
- Don't rename exported symbols unless you also update all import sites
- Don't change default export to named export (or vice versa) without searching every import
