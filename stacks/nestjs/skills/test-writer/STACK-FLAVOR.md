## Framework Detection

- **Jest** (default for NestJS): look for `jest` in devDependencies, `jest.config.ts`/`jest.config.js`, or `"jest"` section in `package.json`
- **@nestjs/testing**: look for `@nestjs/testing` in devDependencies — provides `Test.createTestingModule()`
- **Supertest**: look for `supertest` in devDependencies — used for e2e HTTP testing
- **File naming**: unit tests use `*.spec.ts` next to source files, e2e tests use `test/*.e2e-spec.ts`
- **Config files**: `test/jest-e2e.json` for e2e test configuration

## Framework-Specific Test Patterns

### Unit Testing a Service

Use `Test.createTestingModule` to create an isolated module with mock dependencies:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should find a user by id', async () => {
    const mockUser = { id: 1, email: 'test@example.com', name: 'Test' };
    jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(mockUser);

    const result = await service.findOne(1);

    expect(result).toEqual(mockUser);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
```

### Unit Testing a Controller

Test the controller in isolation, mocking the service layer:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should return an array of users', async () => {
    const result = await controller.findAll();
    expect(result).toEqual([]);
    expect(service.findAll).toHaveBeenCalled();
  });
});
```

### E2E Testing with Supertest

Test the full HTTP lifecycle through the NestJS application:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/users (GET) should return 200', () => {
    return request(app.getHttpServer())
      .get('/users')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('/users (POST) should validate body', () => {
    return request(app.getHttpServer())
      .post('/users')
      .send({ email: 'not-an-email' })
      .expect(400);
  });
});
```

### Mocking Prisma in Tests

Create a reusable mock factory for the Prisma client:

```typescript
// test/prisma-mock.ts
import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';

export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const createMockPrismaClient = (): MockPrismaClient =>
  mockDeep<PrismaClient>();
```

## Mocking Tools

- **jest.fn() / jest.spyOn()** — mock individual functions and methods, track calls and arguments
- **@nestjs/testing `Test.createTestingModule`** — replace any provider with a mock via `useValue`, `useFactory`, or `useClass` in the `providers` array
- **supertest** — HTTP-level testing against the full NestJS app without starting a real server
- **jest-mock-extended** — deep mocking for complex objects like Prisma client (`mockDeep<PrismaClient>()`)
- **jest.clearAllMocks()** — call in `afterEach` or `beforeEach` to reset all mock state between tests
- **jest.useFakeTimers()** — control `Date.now()`, `setTimeout`, `setInterval` for time-dependent logic
