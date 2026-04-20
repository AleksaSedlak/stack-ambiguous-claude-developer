---
paths:
  - "src/**"
  - "app/**"
  - "pages/api/**"
  - "server/**"
  - "api/**"
  - "lib/**"
---

# Error Handling

## Return Values

Pick one discipline per project and stick to it:

- **Result/Either style** — functions that can fail return a discriminated union. Reserve
  `throw` for truly unexpected failures (bugs, infra).
- **Throw style** — functions throw typed `Error` subclasses; callers `try/catch` at the
  boundary.

Don't mix them. Never use `null` or `undefined` as a failure signal when the caller
would want to know *why* it failed.

```ts
// good — discriminated union
type Result<T, E = AppError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export async function findUser(id: string): Promise<Result<User, 'not_found'>> {
  const row = await db.user.findUnique({ where: { id } });
  return row ? { ok: true, value: row } : { ok: false, error: 'not_found' };
}

// good — throw typed errors
export async function chargeCard(amount: number): Promise<Charge> {
  // throws PaymentDeclinedError | NetworkError
}

// bad
function getUser(id: string): User | null {
  // caller can't tell "not found" from "not loaded" from "driver error"
}
```

## Error Classes

One base class per app, subclasses for each distinct failure type the caller should be
able to match on. Give every error a stable `code` for logging and API responses.

```ts
export class AppError extends Error {
  readonly code: string;
  readonly cause?: unknown;
  constructor(code: string, message: string, opts?: { cause?: unknown }) {
    super(message, opts);
    this.name = this.constructor.name;
    this.code = code;
    this.cause = opts?.cause;
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super('not_found', `${resource} ${id} not found`);
  }
}

export class ValidationError extends AppError { /* ... */ }
export class UnauthorizedError extends AppError { /* ... */ }
```

Extend from `Error`. Never throw bare strings, numbers, or plain objects — stack traces
are the only thing you'll have in production logs.

## Async Error Flow

- Always `await` a Promise or explicitly `return` it. A dangling Promise is a floating
  rejection waiting to crash the process. ESLint rule: `@typescript-eslint/no-floating-promises`.
- `try/catch` goes at the **boundary** (HTTP handler, job handler, CLI entry) — not
  scattered throughout services.
- Wrap external SDK calls in a narrow `try/catch` that converts exotic errors into your
  `AppError` taxonomy, then re-throws:

```ts
try {
  return await stripe.charges.create(params);
} catch (err) {
  throw new AppError('payment_failed', 'Stripe charge failed', { cause: err });
}
```

- Inside request handlers, prefer one outer `try/catch` (or a framework-level error
  handler) over many small ones.

## `unknown` in catch

TypeScript 4.4+ types caught errors as `unknown`. Narrow explicitly:

```ts
try {
  await doThing();
} catch (err) {
  if (err instanceof AppError) return { ok: false, error: err };
  if (err instanceof Error) logger.error('unexpected', { err });
  throw err; // let it crash — the process manager will restart
}
```

Never `catch (err: any)` — you lose the type safety TS just gave you.

## Let It Crash (for unexpected errors)

Don't swallow unexpected errors. If something truly unexpected happens, let the process
crash and be restarted by your process manager (pm2, Kubernetes, systemd). A crash with
a clear stack trace is better than silent wrong state.

Install `process.on('unhandledRejection')` and `process.on('uncaughtException')` handlers
that **log and exit**, never silently continue.

## HTTP Boundaries

Translate your `AppError` taxonomy into HTTP responses in **one place** — a framework
error handler, Express error middleware, Nest `ExceptionFilter`, Next.js `error.tsx`.
Handlers and controllers should never shape error responses themselves.

```ts
// Express error middleware — one place maps errors to HTTP
app.use((err, req, res, next) => {
  if (err instanceof NotFoundError)     return res.status(404).json({ code: err.code });
  if (err instanceof ValidationError)   return res.status(422).json({ code: err.code, details: err.details });
  if (err instanceof UnauthorizedError) return res.status(401).json({ code: err.code });

  logger.error('UNHANDLED_REQUEST_ERROR', { err, path: req.path });
  return res.status(500).json({ code: 'internal_error' });
});
```

Never leak stack traces, SQL fragments, or internal file paths in responses.

## Logging Errors

Log at the boundary (controller, job handler, middleware) — not deep inside services.
Services return/throw errors, callers decide whether to log.

Use structured logging with named event strings and explicit fields:

```ts
// good
logger.error('USER_FETCH_FAILED', { userId: id, code: err.code, cause: err });
logger.info('ORDER_CREATED', { orderId: order.id, userId: user.id });
logger.warn('RATE_LIMIT_EXCEEDED', { ip, path });

// bad
console.log('error:', err);
logger.error(`Error fetching user ${id}: ${err}`);
```

Never log secrets, tokens, passwords, or PII. Configure your logger's redact list
(pino `redact`, Winston custom formatter) for sensitive fields.

## Retries

- Retry only at the boundary of an external call you know is safe to retry (idempotent
  read, or write with an idempotency key).
- Exponential backoff with jitter and a **bounded** max attempts. Never infinite retry.
- Never retry on `4xx` client errors — they won't become `2xx` on retry.
- Cancel long-running retries via `AbortSignal` when the caller disconnects.
