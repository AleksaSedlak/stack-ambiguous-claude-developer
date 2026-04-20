---
name: test-writer
description: Write comprehensive tests for new or changed code. Use automatically when new features are added, functions are created, or behavior is modified.
# No disable-model-invocation — Claude can auto-trigger this when adding features.
# Add "disable-model-invocation: true" below if you prefer manual-only via /test-writer.
---

Write comprehensive tests for the code that was just added or changed.

## Step 1: Discover What Changed

- Check `git diff` and `git diff --cached` to identify new/modified functions, classes, components, and modules
- Read each changed file to understand the behavior being added
- Identify the project's existing test framework, patterns, and conventions by finding existing test files:
  - **Vitest** — `vitest.config.ts`, `*.test.ts` / `*.spec.ts`
  - **Jest** — `jest.config.*`, `*.test.ts` / `__tests__/`
  - **Node built-in** — `node --test`, `*.test.mjs` typically in `test/`
  - **Mocha** — `.mocharc.*`, `test/**/*.spec.ts`
  - **Playwright** (e2e) — `playwright.config.ts`, `e2e/` or `tests/`
  - **Cypress** (e2e) — `cypress.config.*`, `cypress/e2e/`
  - **Testing Library** (React/Vue/Svelte) — paired with Vitest/Jest
- Place new test files next to the source files or in the project's established test directory — match whatever the project already does

## Step 2: Analyze Every Code Path

For each new or modified function/method/component, map out:

- **Happy path** — normal input, expected output
- **Edge cases** — empty input, single element, boundary values (0, 1, -1, MAX_SAFE_INTEGER, empty array, empty string, empty object)
- **`null` / `undefined`** — what happens with missing data (and the difference — `?.` returns `undefined`, JSON `null` stays `null`)
- **Type boundaries** — runtime parsing errors (Zod/Valibot/Yup), wrong types at API boundary, coercion traps (`Boolean("false")`, `Number("")`)
- **Error paths** — invalid input, thrown errors, rejected promises, network failures, timeouts, permission denied, 4xx/5xx responses
- **Concurrency** — race conditions, parallel `Promise.all`, shared module-level state, order-dependent mutations
- **State transitions** — initial state, intermediate states, final state, idempotency
- **Integration points** — how this code interacts with its dependencies (DB, HTTP clients, queues, event emitters)

## Step 3: Write the Tests

For EACH scenario identified above, write a test. No skipping.

### Structure

- **One assertion per test** (as a default) — if a test name needs "and", split it into two tests
- **Descriptive names** — test names read as sentences describing the behavior:
  - `it("returns empty array when input is empty", ...)`
  - `it("rejects when email format is invalid", ...)`
  - `it("retries 3 times before failing on network timeout", ...)`
- **Arrange-Act-Assert** — set up, execute, verify. Clear separation with blank lines.

### What to Test

**Pure functions / business logic:**
- Every branch (`if`/`else`, `switch`, ternary, short-circuit `&&`/`||`/`??`)
- Every thrown error with exact error class and message
- Return value types and shapes (use `toEqual` for objects, `toBe` for primitives/reference equality)
- Side effects (mutations, calls to external services)

**API endpoints / handlers (Express / Next.js route handlers / tRPC / NestJS controllers / Fastify / Hono):**
- Success response (status code, body shape, headers)
- Validation errors for each field (missing, wrong type, out of range)
- Authentication / authorization failures (401, 403)
- Rate limiting behavior if applicable
- Idempotency for non-GET methods where specified
- Content negotiation if the API supports multiple formats

**React / Vue / Svelte components:**
- Initial render — correct content shown
- Event handlers — clicks, inputs, submits call the right props/emits
- Conditional rendering — each branch shows correct content
- Accessibility — correct roles, labels, keyboard navigation (use Testing Library queries like `getByRole`)
- Server Components vs Client Components (Next.js App Router) — don't import client-only APIs in server tests

**Database / data layer (Prisma / Drizzle / Knex / Mongoose):**
- CRUD operations return correct data
- Unique constraints reject duplicates
- Cascade deletes work as expected
- Transactions roll back on failure
- Migrations apply and rollback cleanly (for migration tests)

**Async operations:**
- Successful resolution
- Rejection / error handling — `await expect(fn()).rejects.toThrow()`
- Timeout behavior
- Cancellation via `AbortSignal` if supported
- Concurrent calls don't interfere (shared caches, connection pools)

### Mocking Rules

- Prefer real implementations over mocks
- Only mock at system boundaries: network (use MSW, `nock`, or a test server), filesystem (in-memory fs or tmpdir), clock (`vi.useFakeTimers()` / `jest.useFakeTimers()`), random, external APIs
- Never mock the code under test
- If you mock, verify the mock was called with expected arguments (`expect(spy).toHaveBeenCalledWith(...)`)
- Reset mocks between tests — no shared state leaking (`beforeEach(() => vi.restoreAllMocks())`)
- Prefer `vi.spyOn` / `jest.spyOn` over reassigning — it auto-restores

## Step 4: Verify

- Run the new tests — confirm they all pass
- Temporarily break the code (change a return value or invert a condition) — confirm at least one test fails
- If no test fails when code is broken, the tests are useless — rewrite them
- Check coverage: every new function should have at least one test, every branch should be exercised. If the project has a coverage threshold, run `--coverage` and confirm it's met.

## Output

- Complete, runnable test file(s) — not snippets
- Tests grouped by the function/component they cover (`describe` blocks)
- A brief summary: how many tests, what scenarios covered, any gaps you couldn't cover and why
