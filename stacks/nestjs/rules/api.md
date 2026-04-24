---
description: NestJS controller and API handler patterns
alwaysApply: false
paths:
  - "src/**/*.controller.ts"
---

## Request Handling

**Don't:** Put business logic, database queries, or complex transformations directly in controller methods.
**Do:** Keep controllers thin — extract params/body, call a service method, return the result. Controllers handle HTTP concerns (status codes, headers, decorators) while services handle domain logic.
**Why:** Thin controllers are testable without the HTTP layer, reusable across transports (REST, GraphQL, microservices), and easy to review for correctness.

## Input Validation

**Don't:** Trust `@Body()` shapes because TypeScript types say so — types are erased at runtime. Never manually check fields with `if (!body.email)`.
**Do:** Define class-validator DTOs with decorators (`@IsString()`, `@IsEmail()`, `@IsNotEmpty()`, `@Min()`) and apply `ValidationPipe` globally or per-route. Use `whitelist: true` to strip unknown properties and `forbidNonWhitelisted: true` to reject them. Use `@Type(() => Number)` from class-transformer for nested/transformed types.
**Why:** Without `ValidationPipe`, any JSON body passes through unchecked. One missing validation is an injection or crash waiting to happen.

## Response Formatting

**Don't:** Return Prisma/TypeORM entities directly from controllers — this leaks internal fields (password hashes, soft-delete flags, internal IDs).
**Do:** Define response DTOs or use `class-transformer` with `@Exclude()` on sensitive fields and `ClassSerializerInterceptor` globally. Map entities to response shapes in the service or via a dedicated mapper. Use `@ApiResponse()` decorators from `@nestjs/swagger` to document response shapes.
**Why:** Coupling API responses to database schema means every migration is a potential breaking API change. Response DTOs give you a stable contract.

## Error Responses

**Don't:** Throw raw `Error` objects, return inconsistent error shapes from different controllers, or expose stack traces in responses.
**Do:** Use NestJS built-in exceptions (`NotFoundException`, `BadRequestException`, `ForbiddenException`) or custom exceptions extending `HttpException`. Register a global exception filter that formats all errors to a consistent shape: `{ statusCode, message, error }`. Let the exception filter handle unknown errors with a generic 500 response.
**Why:** Consistent error responses make APIs predictable for consumers. A global filter ensures no controller can accidentally leak internal details.
