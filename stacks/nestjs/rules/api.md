---
paths:
  - "src/**/*.controller.ts"
  - "src/**/*.resolver.ts"
  - "src/**/controllers/**"
  - "src/**/dto/**"
---

# API / Controller rules (NestJS)

## Controller shape

A NestJS controller is the HTTP edge. It does four things and nothing else:

1. Declare the route + method with decorators (`@Get`, `@Post`, `@Patch`, `@Delete`).
2. Validate and bind input — `@Body()`, `@Query()`, `@Param()`, with a DTO class
   that has `class-validator` decorators. No hand-written validation in the
   handler body.
3. Call a service method.
4. Return a response DTO (or throw an `HttpException` subclass).

If a handler contains business logic, a DB call, a loop, or anything more than
a few lines, it's wrong — lift it into the service.

```ts
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Post()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.users.create(dto);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<UserResponseDto> {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }
}
```

## Validation

- Every HTTP input is validated by a DTO class at the boundary.
- Enable `ValidationPipe` globally in `main.ts` with
  `{ whitelist: true, forbidNonWhitelisted: true, transform: true }` — this
  strips unknown properties and coerces types.
- Never trust `req.body` directly. Never use `any` on a handler parameter.
- Use `class-validator` decorators (`@IsEmail`, `@IsInt`, `@MinLength`, `@IsUUID`)
  on DTO fields. For cross-field rules, custom validators; don't invent ad-hoc checks.

## Response shape

- Return a response DTO, not the raw entity. This prevents leaking DB-internal
  fields like `password_hash` or `deleted_at`.
- Use a `ClassSerializerInterceptor` + `@Exclude` / `@Expose` on the entity, or
  a dedicated `<feature>.response.dto.ts`. Pick one pattern per project and
  stick with it.
- Collection endpoints return paginated shape: `{ data: T[], total, page, limit }`
  or cursor-based `{ data: T[], nextCursor }`. Don't return a bare array — you
  can't evolve it without a breaking change.

## HTTP status codes

Use the semantic status, not always 200.

| Case                                   | Status |
|----------------------------------------|--------|
| Successful read                        | 200    |
| Successful create (resource returned)  | 201    |
| Successful update, no body             | 204    |
| Successful delete                      | 204    |
| Validation error                       | 400    |
| Missing / invalid auth                 | 401    |
| Authenticated but not allowed          | 403    |
| Resource not found                     | 404    |
| Conflict (unique violation, version)   | 409    |
| Unprocessable (business rule broken)   | 422    |
| Rate limited                           | 429    |
| Unexpected server error                | 500    |

NestJS built-in exceptions: `BadRequestException`, `UnauthorizedException`,
`ForbiddenException`, `NotFoundException`, `ConflictException`,
`UnprocessableEntityException`, `HttpException` (any status). Prefer these
over throwing bare `Error` from a controller.

## Idempotency

- `GET`, `HEAD`, `PUT`, `DELETE` must be idempotent.
- `POST` is not idempotent by default. If a client will retry (payments, webhooks,
  background job triggers), require an `Idempotency-Key` header and dedupe
  server-side in a service (not in the controller).

## Pagination

- Default `limit` (e.g. 20), hard-capped `maxLimit` (e.g. 100). Never allow
  unbounded `limit`.
- Offset pagination is fine for small datasets. For large or frequently-updated
  tables, use cursor-based pagination — stable under inserts.
- Validate `page`, `limit`, and `cursor` in the DTO. Reject negative / zero / huge values.

## Rate limiting

- Use `@nestjs/throttler` for app-wide rate limits. Apply `ThrottlerGuard` globally.
- Per-route limits via `@Throttle({ default: { limit: N, ttl: ms } })`.
- Authenticated limits keyed on user ID; unauthenticated keyed on IP + user-agent.
- Login / forgot-password / webhook ingest endpoints need their own stricter bucket.

## Webhooks

- Verify signatures (HMAC over raw body) before parsing. Use
  `timingSafeEqual` from `node:crypto` — not `===`.
- Reject stale timestamps (> 5 minutes) to defeat replay attacks.
- Return 2xx only after the work is persisted (or queued durably). Don't 2xx
  optimistically and then lose the payload.

## OpenAPI / Swagger

- If `@nestjs/swagger` is used, decorate every DTO field with `@ApiProperty`
  and every handler with `@ApiOperation` + `@ApiResponse`. An out-of-date
  Swagger doc is worse than none — callers will trust it and break.
- Document error responses too (`@ApiResponse({ status: 404, ... })`), not
  just the happy path.
