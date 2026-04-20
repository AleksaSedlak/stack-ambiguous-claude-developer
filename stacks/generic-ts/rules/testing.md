---
alwaysApply: true
---

# Testing

## Principles

- Write tests that verify behavior, not implementation details.
- Prefer real implementations over mocks. Only mock at system boundaries (HTTP, DB driver,
  filesystem, clock, queue).
- If a test is flaky, fix or delete it. Never retry to make it pass.
- No logic (if/loops) in tests — if you need branching, write two tests.
- Run the specific test file after changes, not the whole suite. Framework-specific:
  - Vitest: `vitest run path/to/file.test.ts`
  - Jest: `jest path/to/file.test.ts`
  - Node runner: `node --test path/to/file.test.ts`

## Naming & Structure

`it('does thing when condition')` — test names read as sentences. Group with
`describe('functionName')` or `describe('ClassName')`.

Default to Arrange-Act-Assert. Interleaved assertions are OK for integration tests when
phases are clearly separated.

```ts
describe('createUser', () => {
  it('returns a user when input is valid', async () => {
    // Arrange
    const input = { email: 'a@b.com', name: 'Ada' };

    // Act
    const result = await createUser(input);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.email).toBe('a@b.com');
  });
});
```

## Test Types & Where They Live

| Type | Location | What it tests |
|---|---|---|
| Unit | next to source as `*.test.ts` or in `tests/unit/` | Pure functions, no I/O |
| Integration | `tests/integration/` | Services + real DB (transactional rollback) |
| E2E | `tests/e2e/` or `e2e/` | HTTP boundary — start the app, hit endpoints |
| Component (UI) | next to component as `*.test.tsx` | Render + interaction (Testing Library) |

Match whatever layout already exists in the project.

## Database Isolation

- Run integration tests inside a transaction that rolls back at the end of each test, or
  use a schema-per-test strategy. Never rely on `DELETE FROM table` between tests — it's
  slow and order-dependent.
- Prisma: use `$transaction` with a rollback strategy, or a dedicated testing helper
  (`@quramy/prisma-fabbrica`, `jest-prisma`). Drizzle/Knex: wrap tests in transactions via
  the adapter's test helpers.

## Factories

Plain functions in `tests/__fixtures__/` or `tests/support/factory.ts`. No factory library
required:

```ts
let seq = 0;
export function buildUser(attrs: Partial<User> = {}): User {
  seq += 1;
  return { id: `u_${seq}`, email: `user${seq}@example.com`, ...attrs };
}

export async function insertUser(
  db: Db,
  attrs: Partial<User> = {},
): Promise<User> {
  const user = buildUser(attrs);
  await db.insert(users).values(user);
  return user;
}
```

## Mocking

- Mock at boundaries: HTTP clients, DB drivers, filesystem, clock (`Date.now`, `setTimeout`),
  crypto randomness, third-party SDKs.
- Use `vi.mock` / `jest.mock` at the module level, not ad-hoc. Reset between tests
  (`beforeEach(() => vi.restoreAllMocks())`).
- HTTP: use `msw` for request-level mocking — more realistic than mocking fetch directly.
- Clock: use fake timers (`vi.useFakeTimers()` / `jest.useFakeTimers()`) — advance time
  explicitly, never `setTimeout` in tests to wait for a timer.
- Never mock the function or class under test.
- If a mock needs more than 5 lines of setup, the production code probably needs
  restructuring — see if you can inject a collaborator instead.

## Assertions

- Assert specific values, not "truthy". `expect(result).toBe(42)`, not
  `expect(result).toBeTruthy()`.
- Pattern match on discriminated union results:
  ```ts
  expect(result.ok).toBe(true);
  if (result.ok) expect(result.value).toEqual({ ... });
  ```
- Errors: `expect(() => fn()).toThrow(ValidationError)` for sync, `await
  expect(promise).rejects.toThrow(ValidationError)` for async.
- Floating-point: `toBeCloseTo(x, decimals)`, never `toBe`.
- DOM: use Testing Library queries that mirror user behavior (`getByRole`, `getByLabelText`)
  — `getByTestId` is a last resort.

## Async & Concurrency

- Always `await` async assertions. A missing `await` turns the test into a silent
  false-negative.
- Tests must be independent and safe to run in parallel (`vitest` / `jest -p`). Shared
  global state (singletons, module-level caches, env vars) is a test-design smell.
- For timers and polling, use fake timers, not real `setTimeout`.

## Coverage

- Coverage is a symptom, not a goal. New code should have meaningful tests for happy path,
  edge cases, and errors — not 100% line coverage through synthetic assertions.
- If a code path is hard to hit from a test, it's usually hard to reason about in
  production too. Refactor to make it testable.
