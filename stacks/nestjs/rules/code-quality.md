---
alwaysApply: true
---

# Code quality (NestJS)

## TypeScript strictness

- `strict: true`. Also: `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`.
- No `any` in application code. Use `unknown` + narrowing. `any` in a third-party
  shim is OK with a comment explaining why.
- No non-null assertions (`foo!`) except where the type system can't see the
  existence check (regex captures, post-`find` with explicit narrowing).
- Every exported function has an explicit return type. Inference is fine inside
  function bodies, not at the module boundary.

## Module boundaries

- A NestJS module is a **boundary**. External code imports only from the module's
  public exports declared in `@Module({ exports: [...] })`.
- Services are injected, not `new`ed. A service that `new`s another service
  bypasses the DI graph and breaks testability.
- No circular imports between modules. If you have one, extract the shared piece
  into `common/` or `shared/` (or make it an event).
- Cross-module communication: inject a service from an imported module, or use
  `@nestjs/event-emitter` / a real queue. Never reach across into another
  module's internal files.

## File naming

Follow NestJS conventions so the CLI and pattern matchers work:

| Kind          | Filename                            |
|---------------|-------------------------------------|
| Module        | `users.module.ts`                   |
| Controller    | `users.controller.ts`               |
| Service       | `users.service.ts`                  |
| Repository    | `users.repository.ts`               |
| DTO           | `dto/create-user.dto.ts`            |
| Entity        | `entities/user.entity.ts`           |
| Guard         | `guards/jwt-auth.guard.ts`          |
| Interceptor   | `interceptors/logging.interceptor.ts` |
| Pipe          | `pipes/parse-object-id.pipe.ts`     |
| Filter        | `filters/all-exceptions.filter.ts`  |
| Decorator     | `decorators/current-user.decorator.ts` |
| Unit test     | `users.service.spec.ts`             |
| E2E test      | `test/users.e2e-spec.ts`            |

kebab-case filenames, PascalCase class names.

## TSDoc

- Exported functions with non-obvious semantics get a TSDoc block above them.
- `@param` / `@returns` only when they add information beyond the type. Don't
  write `@param id - The id` — useless noise.
- `@throws` on any function that throws an `HttpException` or custom error.
- `@deprecated` must point to the replacement: `@deprecated use {@link X} instead`.

```ts
/**
 * Creates a user and sends a verification email.
 *
 * @throws {@link ConflictException} if the email is already registered
 */
async create(dto: CreateUserDto): Promise<UserResponseDto> { ... }
```

## Function / class structure

- Inside a class: fields → constructor → public methods → private helpers.
- Inside a module file: imports → decorators → class declaration.
- Keep class method bodies flat. If you have 3+ levels of nesting, extract a
  private method.
- Controllers < ~150 lines; services < ~300 lines. Past that, split by concern.

## Exhaustive switch

Pair a discriminated union with a `never` check so new variants produce a compile
error at every match site:

```ts
type Status = { kind: 'pending' } | { kind: 'done'; at: Date } | { kind: 'failed'; reason: string };

function describe(s: Status): string {
  switch (s.kind) {
    case 'pending': return 'waiting…';
    case 'done':    return `done at ${s.at.toISOString()}`;
    case 'failed':  return `failed: ${s.reason}`;
    default: {
      const _exhaustive: never = s;
      throw new Error(`Unhandled status: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

## Imports

- Absolute imports via `baseUrl` + `paths` (e.g. `@app/users/users.service`).
  Relative imports only within the same module folder.
- Don't import from `src/index.ts` — that's for external consumers, not internal files.
- Sort imports: `node:*` built-ins → external packages → `@nestjs/*` →
  `@app/*` → relative `./`. Let ESLint `simple-import-sort` handle it.
