---
alwaysApply: true
---

# Testing rules (NestJS)

## Test types

- **Unit** — one class/function, everything else mocked via `Test.createTestingModule`
  overrides. Filename: `*.spec.ts`, co-located with source.
- **Integration** — module-level, real DB (test container or in-memory SQLite),
  real services, only external calls mocked. Still `*.spec.ts`, usually near the module.
- **E2E** — boot the whole Nest app, hit real HTTP via `supertest`. Lives in
  `test/` with `*.e2e-spec.ts`. Uses `jest-e2e.json` config.

Pick the right level. Don't write a unit test for a controller that only wires
DI — that tests nothing real. E2E test it, or test the service.

## Structure

Arrange–Act–Assert, separated by blank lines:

```ts
describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: createMock<UsersRepository>() },
      ],
    }).compile();
    service = module.get(UsersService);
    repo = module.get(UsersRepository);
  });

  it('throws ConflictError when email already exists', async () => {
    // Arrange
    repo.findByEmail.mockResolvedValue({ id: 1, email: 'a@b.c' });

    // Act & Assert
    await expect(service.create({ email: 'a@b.c', password: 'x' }))
      .rejects.toBeInstanceOf(ConflictError);
  });
});
```

## Naming

Test names read as sentences describing behavior:

- `it('returns 0 for an empty cart', ...)`
- `it('throws NotFoundError when user does not exist', ...)`
- `it('retries 3 times on a 503 then fails', ...)`

Never `it('should work', ...)` / `it('works correctly', ...)`.

## One behavior per test

One test verifies one behavior. Multiple assertions proving that single behavior are fine
(e.g., checking status code + response body + side effect for one endpoint call). If the
test name needs "and" describing two *different* behaviors, split it.

## What to cover

For every new or changed public method:

- Happy path — the simplest valid input and expected output.
- Degenerate cases — `null` / `undefined`, empty arrays, zero, empty strings.
- Edge cases — boundary values (0, 1, -1, max), very long strings, Unicode.
- Error paths — invalid input, DB errors, external service failures, timeouts.
- Auth/authz — unauthenticated, wrong role, wrong tenant.
- Concurrency — if the code has shared state, test two parallel calls.

Every branch in the production code must be exercised by at least one test.

## Mocking rules

- Mock at the **boundary**: repository (DB), HTTP client, queue, clock, random,
  file system.
- Don't mock the code under test. If you need to, the design is wrong — pass
  the collaborator as a dependency.
- Don't deep-mock a class. If you're mocking 5 methods of something, take a
  narrower interface and mock that.
- Reset mocks between tests (`jest.restoreAllMocks()` / `vi.restoreAllMocks()`
  in `afterEach`). No shared mock state leaking.
- Prefer real implementations for pure code. A fake in-memory repository is
  often clearer than 20 `mockResolvedValue` lines.

## NestJS-specific

- Use `Test.createTestingModule(...).compile()` for unit/integration.
- Override providers with `.overrideProvider(X).useValue(...)`.
- Override guards with `.overrideGuard(AuthGuard('jwt')).useValue({ canActivate: () => true })`
  in E2E, then write separate tests that exercise the real guard.
- For e2e: `const app = module.createNestApplication(); await app.init();`
  then `request(app.getHttpServer())`.
- Close the app in `afterAll(async () => { await app.close(); })` — leaks cause
  Jest to hang.

## Database in tests

- **Integration/E2E**: use a real Postgres in a test container
  (`@testcontainers/postgresql`) or a disposable DB per test run. SQLite is OK
  if you don't use Postgres-specific features.
- Reset between tests: truncate all tables (faster than migrate-down/up), or
  wrap each test in a transaction that rolls back.
- No shared DB state between tests. No `it.only` snowball effects.

## Async tests

- Always `await` async assertions:
  `await expect(fn()).rejects.toBeInstanceOf(ValidationError)`.
- Use fake timers (`jest.useFakeTimers()`) for code that calls `setTimeout` /
  `setInterval` — real timers make tests flaky and slow.
- Don't sleep. `await new Promise(r => setTimeout(r, 100))` in a test is a
  red flag. Use fake timers or event-based signals.

## Proving the test catches the bug

After writing a test, temporarily break the production code (invert a condition,
change a return value). The test must fail. If it passes, the test isn't
actually testing the behavior — rewrite it.

## What NOT to test

- Framework internals (`NestFactory.create` itself).
- Third-party library behavior (trust `class-validator` validates; you don't
  need to assert that `@IsEmail` rejects `'foo'`).
- Getters/setters with no logic.
- Trivial re-exports.
