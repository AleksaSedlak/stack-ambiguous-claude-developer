---
name: tdd
description: Test-Driven Development loop — write a failing test first, then the minimum code to pass it, then refactor. Repeat.
argument-hint: "[feature description, function signature, or Jira ticket e.g. PROJ-123]"
disable-model-invocation: true
---

Build the following using strict Test-Driven Development:

**Feature**: $ARGUMENTS

## Step 0: Understand the Feature

Determine what kind of input `$ARGUMENTS` is:

- **Jira ticket** (e.g., `PROJ-123`) → fetch from the Jira MCP server if configured. If no Jira MCP is available, ask the user to paste the ticket description. Extract the acceptance criteria and requirements, then proceed.
- **Function signature** (e.g., `function deactivateUser(id: number): Promise<Result<User, UserError>>`) → use the signature to derive behaviors directly.
- **Feature description** (plain text) → use as-is.

Once you have clear requirements, identify the project's test framework (Vitest, Jest, Node built-in test runner, Mocha) by scanning `package.json` + existing test files. Use whatever the project already uses — don't introduce a new framework.

## The TDD Cycle

Repeat this cycle for each behavior. Never skip steps.

### Red: Write a Failing Test

1. Write ONE test for the smallest next behavior (not the whole feature)
2. The test must:
   - Describe the behavior in its name: `it("returns 0 for empty cart", ...)` / `test("returns 0 for empty cart", ...)`
   - Use Arrange-Act-Assert structure
   - Assert specific values, not vague truths (avoid `.toBeTruthy()` when `.toBe(42)` is possible)
3. **Run the test. It MUST fail.** If it passes, either:
   - The behavior already exists (skip to the next behavior)
   - The test is wrong (it's not testing what you think — fix it)
4. Verify the failure message makes sense — it should tell you what's missing

### Green: Write the Minimum Code to Pass

1. Write the **simplest, most obvious code** that makes the failing test pass
2. Don't generalize. Don't make it elegant. Don't handle cases the test doesn't cover.
3. Hardcoding is fine if only one test exists for that path — the next test will force generalization
4. **Run the test. It MUST pass.** If it doesn't, fix the code (not the test — the test defined the behavior)
5. Run ALL tests. Nothing previously passing should break.

### Refactor: Clean Up Without Changing Behavior

1. Look for: duplication, unclear names, functions doing too much, magic values, types that could be narrowed
2. Make ONE improvement at a time
3. **Run ALL tests after each change.** If anything breaks, undo immediately.
4. Stop refactoring when the code is clean enough — don't gold-plate

## Choosing What to Test Next

Work from simple to complex:
1. **Degenerate cases** — `null`/`undefined` input, empty array/object/string, zero
2. **Happy path** — the simplest valid input
3. **Variations** — different valid inputs that exercise different branches
4. **Edge cases** — boundary values, max sizes, Unicode/emoji, very long strings, leap seconds
5. **Error cases** — invalid input, thrown errors, rejected promises, network failures, timeouts
6. **Type boundaries** — at the edges of the system, verify parsing/validation (Zod, Valibot, Yup) rejects bad input
7. **Integration** — how this connects to the rest of the system

Each test should require a small code change. If you need to write more than ~10 lines of production code to pass a test, the test is too big — split it.

## Rules

- **Never write production code without a failing test that demands it.**
- **Never write more than one failing test at a time.** One red → green → refactor cycle at a time.
- **The test drives the design.** If the code is hard to test, the design is wrong — change the design, not the test approach.
- **Don't mock what you own.** If you need to mock your own code to test it, the code needs restructuring. Mock only at boundaries (network, filesystem, clock, random, external APIs).
- **Prefer real I/O at the unit level when fast** — `fetch` against a test server, an in-memory SQLite, a memory store — over heavy mocks.
- **Commit after each green+refactor cycle.** Small, passing, meaningful commits.

## Output

After each cycle, briefly state:
- **Test**: what behavior was added
- **Code**: what changed to make it pass
- **Refactor**: what was cleaned up (or "none needed")

When the feature is complete, provide a summary of all behaviors covered and any gaps that would need integration or manual testing.
