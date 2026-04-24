---
description: Error handling patterns for NestJS
alwaysApply: false
paths:
  - "src/**"
---

## Error Classes

**Don't:** Throw bare strings, plain objects, or generic `Error` instances. Don't use `HttpException` directly for domain-specific errors.
**Do:** Create domain-specific exception classes extending NestJS built-in HTTP exceptions: `UserNotFoundException extends NotFoundException`, `InsufficientCreditsException extends BadRequestException`, `OrderAlreadyShippedException extends ConflictException`. Include a stable error code string in the response object for client-side matching.
**Why:** Domain exceptions make catch blocks readable and enable the exception filter to map them precisely. `throw new UserNotFoundException(userId)` is self-documenting; `throw new Error('not found')` is not.

Additional guidelines:
- Define a base `DomainException` class with a `code` property for machine-readable error identification
- Group exception classes in `common/exceptions/` so they are discoverable and importable across modules
- Include relevant context in the exception (resource type, ID, reason) for debugging without leaking internals to clients
- Use appropriate HTTP status codes: 400 for validation, 401 for auth, 403 for authorization, 404 for not found, 409 for conflicts, 422 for business rule violations

## Async Error Flow

**Don't:** Leave promises unhandled (fire-and-forget), forget to `await` async calls, or use `.then()` without `.catch()` in a NestJS context.
**Do:** Always `await` async operations in controllers and services — NestJS catches thrown exceptions automatically from async handlers. Use `Promise.all()` for concurrent operations (it rejects on first failure). For background tasks that intentionally run detached, wrap in try/catch and log errors explicitly.
**Why:** Unhandled promise rejections crash the Node.js process in modern runtimes. NestJS exception filters only catch errors that are thrown or rejected from the handler chain — floating promises bypass them entirely.

Additional guidelines:
- Enable `--unhandled-rejections=throw` in Node.js to surface floating promises during development
- Use `Promise.allSettled()` when you need all results even if some fail (batch operations)
- For event-driven flows (EventEmitter, CQRS), wrap handlers in try/catch because they run outside the HTTP request context
- Never swallow errors with empty catch blocks — at minimum, log them

## HTTP Boundaries

**Don't:** Let each controller format its own error response with ad-hoc shapes. Don't catch exceptions in controllers just to re-throw them with a different format.
**Do:** Register a global exception filter (`APP_FILTER`) that maps all exceptions to a consistent response shape: `{ statusCode, message, error, timestamp }`. Map domain exceptions to HTTP status codes in this single filter. Let unknown exceptions return 500 with a generic message (never expose stack traces). Use `@Catch()` with specific exception types for special handling.
**Why:** A single exception filter is the one place where error-to-HTTP mapping lives. Every controller benefits automatically, and API consumers get predictable error payloads.

Additional guidelines:
- Include a `path` field in error responses so clients know which endpoint failed
- In development mode, include the stack trace in the response; in production, omit it completely
- For validation errors from `ValidationPipe`, format the `message` as an array of human-readable field errors
- Document the error response shape in Swagger/OpenAPI with `@ApiResponse()` decorators

## Logging

**Don't:** Use `console.log` for production logging. Don't log full request bodies, user objects, or tokens.
**Do:** Use a structured logger (`pino` via `nestjs-pino`, or `winston`) configured as a NestJS LoggerService. Attach correlation IDs via middleware (generate a UUID per request and pass it through the logger context). Log error name, message, and stack at `error` level. Redact PII fields (`password`, `token`, `authorization`, `ssn`) in the logger configuration.
**Why:** Unstructured logs are unsearchable in production. Logging secrets or PII violates compliance requirements and creates breach risk. Correlation IDs let you trace a single request across all service calls.

Additional guidelines:
- Set log levels per environment: `debug` in development, `info` in staging, `warn` in production
- Log at request boundaries: method, path, status code, and response time for every request
- For downstream service calls, propagate the correlation ID in request headers
- Use the NestJS `Logger` class (not raw pino/winston) so that log output is consistent across all providers
- Never log raw database queries in production — they may contain sensitive data in WHERE clauses
