---
paths:
  - "src/**"
  - "test/**"
---

# Error handling (NestJS)

## Error taxonomy

Define a small set of error classes. Don't throw strings, plain objects, or bare
`Error`.

```ts
// src/common/errors/app.error.ts
export abstract class AppError extends Error {
  abstract readonly code: string;
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError { readonly code = 'NOT_FOUND'; }
export class ConflictError extends AppError { readonly code = 'CONFLICT'; }
export class ValidationError extends AppError { readonly code = 'VALIDATION'; }
export class UnauthorizedError extends AppError { readonly code = 'UNAUTHORIZED'; }
export class ForbiddenError extends AppError { readonly code = 'FORBIDDEN'; }
export class ExternalServiceError extends AppError { readonly code = 'EXTERNAL_SERVICE'; }
```

Services throw `AppError` subclasses. A global exception filter translates them
into `HttpException` responses.

## The global exception filter

One `@Catch()` filter at the app level. It:

1. Maps `AppError` → appropriate `HttpException` status + response shape.
2. Lets `HttpException` pass through (with optional response shaping).
3. Catches *everything else* as 500 internal, logs with stack + cause, returns
   a safe body (no stack in the response).

```ts
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse();
    if (exception instanceof AppError) {
      const status = this.mapStatus(exception.code);
      return res.status(status).json({ error: exception.code, message: exception.message });
    }
    if (exception instanceof HttpException) {
      return res.status(exception.getStatus()).json(exception.getResponse());
    }
    this.logger.error('Unhandled', exception instanceof Error ? exception.stack : exception);
    return res.status(500).json({ error: 'INTERNAL', message: 'Internal server error' });
  }
}
```

Register it globally in `main.ts` via `app.useGlobalFilters(new AllExceptionsFilter(...))`.

## `catch (err)` rules

- Always narrow. `err` is `unknown` post TS 4.4:
  ```ts
  try {
    await something();
  } catch (err) {
    if (err instanceof HttpException) throw err;
    if (err instanceof Prisma.PrismaClientKnownRequestError) { ... }
    throw new ExternalServiceError('unexpected', err);
  }
  ```
- Never `catch (err: any)`. Never `catch (err: Error)` — not sound in TS.
- Never swallow silently. `try { ... } catch {}` without a comment is a bug.

## Where to catch

- **Don't try/catch in services just to re-throw.** Let errors propagate up to
  the filter. Wrap only to add context (`new AppError('x failed', { cause: err })`).
- **Do try/catch at boundary calls** — HTTP clients, DB calls, external SDKs —
  specifically to translate their error into an `AppError` domain type.
- **Do try/catch in event handlers / subscribers / cron / queue consumers** —
  those aren't inside a request, so a filter won't catch them. Log + report.

## Promise rejections

- Never leave a floating promise. Either `await` it, `return` it, or attach a
  `.catch` that explicitly logs.
- `Promise.all` is fail-fast — if one rejects, the others still run but their
  results are discarded. If you need per-item error reporting, use
  `Promise.allSettled`.
- Unhandled rejections at the process level must be captured and logged (Nest
  logs them by default, but verify in your logger setup).

## Operational vs programmer errors

- **Operational** (network blip, DB lock, validation failure) — expected,
  handled gracefully, maybe retried.
- **Programmer** (null deref, bad type, impossible state reached) — a bug. Crash
  loudly in dev, log with stack in prod, alert the on-call. Don't try to
  "recover" from a programmer error — you don't know what state you're in.

## Retries

- Only retry idempotent operations.
- Exponential backoff + jitter, not a tight loop.
- Cap total attempts (3–5). Cap total elapsed time. Log every retry attempt.
- Don't retry on 4xx responses (client error — retry won't help). Retry 5xx,
  timeouts, connection resets, and specific ORM "deadlock / serialization"
  error codes.

## Logging errors

- Log with the structured logger, not `console.error`.
- Include: `code`, `message`, `stack`, `cause`, `requestId`, `userId` (if applicable).
- Don't log and rethrow — that produces duplicate log lines. Log at the
  catch site that actually handles the error, or let the filter do it.

## Graceful shutdown

- Implement `onApplicationShutdown(signal)` on modules that hold resources
  (DB pool, queue consumer, HTTP keep-alive).
- Stop accepting new work → drain in-flight → close connections → exit.
- Enable `app.enableShutdownHooks()` in `main.ts` so SIGTERM triggers the hook.
