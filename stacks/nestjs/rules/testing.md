---
description: Testing patterns for NestJS
alwaysApply: true
---

## Principles

**Don't:** Assert how a service calls its dependencies (mock call counts, argument order) rather than what it produces.
**Do:** Test behavior: given this input and state, expect this output or side effect. Test the contract, not the wiring.
**Why:** NestJS services are swappable by design. Tests coupled to implementation break every time you refactor DI wiring, even when behavior is unchanged.

Additional guidelines:
- Each test should be independent — no shared mutable state between tests
- Prefer `beforeEach` over `beforeAll` for test module setup to ensure isolation
- Tests must pass when run in any order and in parallel

## Naming

**Don't:** Name tests `it('should work')` or `it('test create')`.
**Do:** Name tests as behavior sentences: `it('returns 404 when user does not exist')`, `it('creates a user and returns the created entity')`, `it('throws ForbiddenException when user lacks admin role')`.
**Why:** When a test fails in CI, the `describe` + `it` name is all you see. It must tell you what broke without reading the test body.

Additional guidelines:
- Use nested `describe` blocks to group related scenarios: `describe('findOne')` > `describe('when user exists')` > `it('returns the user')`
- Start `it` blocks with a verb: "returns", "throws", "creates", "emits", "rejects"
- Never use "should" — it adds no information (`it('returns 404')` not `it('should return 404')`)

## Structure

**Don't:** Scatter test files in a separate mirror tree or mix setup, action, and assertions throughout the test body.
**Do:** Co-locate unit tests next to source files as `*.spec.ts` (e.g., `users.service.spec.ts` beside `users.service.ts`). Place e2e tests in the top-level `test/` directory as `*.e2e-spec.ts`. Use Arrange-Act-Assert in every test: set up state, perform one action, then assert results.
**Why:** Co-located tests are discoverable — you see immediately if a file lacks coverage. AAA structure makes tests scannable at a glance.

Additional guidelines:
- Keep each test focused on one behavior — multiple assertions are fine if they verify one logical outcome
- Use factory functions or fixtures for test data creation, not copy-pasted object literals
- Extract shared test module configurations into helper functions to reduce boilerplate

## Mocking

**Don't:** Mock the class under test, deep-mock entire modules, or bypass the NestJS DI container with manual instantiation in tests.
**Do:** Use `Test.createTestingModule()` with mock providers for dependencies. Provide mocks via `useValue` or `useFactory`. Use `supertest` (`request(app.getHttpServer())`) for e2e tests against the real NestJS HTTP pipeline. Mock only at system boundaries — database, external HTTP, filesystem.
**Why:** `Test.createTestingModule` mirrors production DI. Skipping it means guards, pipes, and interceptors are untested. Over-mocking creates tests that pass with broken code.

Additional guidelines:
- For repository mocks, define the mock object once in a factory and reuse across tests
- In e2e tests, use a real test database (SQLite or Docker Postgres) when possible instead of mocking Prisma
- Use `jest.spyOn()` for verifying side effects (e.g., event emission) without replacing the implementation
- Reset mocks in `beforeEach` to avoid state leaking between tests

## Coverage

**Don't:** Chase 100% line coverage with no-op tests or duplicate the implementation in assertions.
**Do:** Write unit tests for every service method (happy path + error paths + edge cases). Write controller unit tests to verify correct service delegation and response shaping. Write e2e tests for critical user journeys (auth flow, CRUD operations, error responses). Cover guards and custom pipes with their own spec files.
**Why:** A service test that hits a line without asserting its output is a false signal. E2e tests catch integration issues that unit tests miss — middleware ordering, validation pipes, exception filters.

Additional guidelines:
- Prioritize testing: services first (business logic), then guards/pipes (security), then controllers (integration), then e2e (critical paths)
- Every bug fix should include a regression test that fails without the fix
- Use coverage reports to find untested error paths, not as a target metric
