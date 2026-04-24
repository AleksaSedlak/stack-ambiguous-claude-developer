## Framework Detection

| Signal | Test framework |
|--------|---------------|
| `jest` in devDeps + `jest.config.*` or `"jest"` key in package.json | Jest (default for NestJS) |
| `vitest` in devDeps + `vitest.config.*` | Vitest (less common but growing) |
| `@nestjs/testing` in devDeps | NestJS testing utilities (always present) |
| `supertest` in devDeps | HTTP integration testing |
| `*.spec.ts` files co-located with source | Unit tests |
| `test/*.e2e-spec.ts` + `jest-e2e.json` | E2E tests |

## Framework-Specific Test Patterns

**NestJS unit tests (services, repositories):**
- Use `Test.createTestingModule()` from `@nestjs/testing` to create an isolated module
- Provide mocks for all dependencies via `{ provide: XService, useValue: mockXService }`
- Test service methods in isolation — mock the repository, assert service logic
- Test guards by calling `canActivate()` directly with a mock `ExecutionContext`
- Test pipes by calling `transform()` directly with mock values

```typescript
const module = await Test.createTestingModule({
  providers: [
    UserService,
    { provide: UserRepository, useValue: { findOne: jest.fn() } },
  ],
}).compile();
const service = module.get(UserService);
```

**NestJS controller tests:**
- Use `Test.createTestingModule()` with the controller and mocked services
- Assert response DTOs match expected shapes
- Test exception filters by throwing from mocked services and asserting the HTTP response

**NestJS e2e tests:**
- Use `Test.createTestingModule()` with the full AppModule (or a test-specific module)
- Use `supertest` via `app.getHttpServer()` to send real HTTP requests
- Set up a test database (in-memory SQLite or a test Postgres schema)
- Use `beforeAll` to create the app, `afterAll` to close it

```typescript
const app = moduleFixture.createNestApplication();
app.useGlobalPipes(new ValidationPipe());
await app.init();
const response = await request(app.getHttpServer())
  .post('/users')
  .send({ email: 'test@example.com' })
  .expect(201);
```

**Prisma / TypeORM tests:**
- For Prisma: mock `PrismaService` or use a test database with `prisma migrate reset`
- For TypeORM: use `TypeOrmModule.forRoot()` with an in-memory SQLite database
- Test repository methods by asserting DB state before/after operations
- Always clean up test data between tests

## Mocking Tools

- **`jest.fn()` / `jest.spyOn()`** — standard Jest mocking for service methods and repository calls
- **`@nestjs/testing` `Test.createTestingModule()`** — the canonical way to create test modules with mock providers
- **`supertest`** — HTTP-level integration testing against `app.getHttpServer()`
- **Never mock NestJS decorators or the DI container** — if you need to mock a dependency, provide a mock in the test module
- **Reset mocks**: use `jest.clearAllMocks()` in `beforeEach` or `afterEach`
