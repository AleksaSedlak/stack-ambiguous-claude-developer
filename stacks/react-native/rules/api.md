---
paths:
  - "src/**/controllers/**"
  - "src/**/routes/**"
  - "src/api/**"
  - "app/api/**"
  - "pages/api/**"
  - "server/**"
  - "routes/**"
---

# API Handlers

## Handler Shape

Controllers / route handlers are **thin**. The shape is always:

1. Validate input with a schema (Zod/Valibot/class-validator). Reject malformed early.
2. Call a service function with the parsed, typed input.
3. Shape the response — map domain objects to DTOs, set status, set headers.

No business logic. No ORM calls. No inline try/catch wrapping service logic — use the
framework error handler.

```ts
// good — Express + Zod
const CreateUserSchema = z.object({ email: z.string().email(), name: z.string().min(1).max(80) });

app.post('/users', async (req, res) => {
  const input = CreateUserSchema.parse(req.body);        // 1. validate
  const user = await usersService.createUser(input);     // 2. service
  res.status(201).json(toUserDto(user));                 // 3. shape
});
```

## Validation

- Validate `body`, `query`, and `params` separately — they have different rules.
- Coerce types at the boundary (e.g., `z.coerce.number()` for query strings). Inside
  services, work only with typed values.
- Return 422 (or 400, per your project convention) with field-level error details for
  validation failures — not a generic 500.

## HTTP Semantics

- Status codes match semantics:
  - 200 OK (GET with body), 201 Created (POST that created), 204 No Content (DELETE, PATCH
    with no response body)
  - 400 bad request shape, 401 unauthenticated, 403 unauthorized, 404 not found, 409
    conflict, 422 validation
  - 429 rate-limited, 500 unexpected, 503 temporary/upstream
- `GET` is idempotent and safe — no side effects, ever.
- `PUT`/`DELETE` are idempotent — calling twice produces the same state.
- `POST` is not idempotent by default. Accept an `Idempotency-Key` header for endpoints
  where clients retry (payments, orders).

## Response Shape

Pick one shape for the whole API and stick to it. Common options:

```ts
// plain — most common
res.json(userDto)
res.status(422).json({ code: 'validation_error', errors: [...] })

// envelope
res.json({ data: userDto })
res.json({ data: null, error: { code: 'not_found', message: '...' } })
```

Never leak internal fields (`password_hash`, `internal_note`) — map to DTOs explicitly.
Don't `res.json(user)` on a raw ORM model.

## Pagination

- Every list endpoint has pagination. Never return "all rows" on a user-facing list.
- Cursor pagination beats offset pagination for large or frequently-updated tables. Use
  the `(created_at, id)` tuple as the cursor, not a raw offset.
- Return `nextCursor: string | null` — clients pass it back as `?cursor=...`.

## Rate Limiting & Timeouts

- Rate-limit auth endpoints per IP and per account. Use a shared store (Redis) in
  multi-instance deployments.
- Every outbound HTTP call has a timeout (`AbortSignal.timeout(ms)`). No call should hang
  indefinitely.
- Every inbound request has a timeout enforced at the server (Node's default is none).

## Content & Encoding

- Set `Content-Type: application/json; charset=utf-8` explicitly if the framework doesn't.
- Enforce max body size at the parser (`express.json({ limit: '100kb' })`). Default
  limits are often too generous for JSON endpoints.
- Validate `Content-Type` on write endpoints — reject `application/x-www-form-urlencoded`
  if you only accept JSON.

## Authentication & Authorization

- Auth is a pipeline/middleware concern, not a per-handler concern. Route groups share
  auth pipelines (`authenticate`, `requireRole('admin')`).
- Within a handler, the authenticated user is available via `req.user` / context —
  never re-fetch the session per-handler.
- Authorization checks for row-level access happen in the service, not the handler.

## Idempotency

- `POST /payments` with an `Idempotency-Key` header: store the key + response for a
  window (e.g., 24h). Return the stored response on retry instead of re-charging.
- Webhook receivers: dedupe by the webhook event ID. Treat `(source, event_id)` as a
  unique constraint.

## Errors at the Boundary

- Never `try/catch` in handlers to shape a response. Use the framework error handler
  (Express `app.use(errorHandler)`, Nest `ExceptionFilter`, Next.js `error.tsx`).
- Log at the error handler with request context — method, path, user ID, correlation ID.
- Never return stack traces, SQL fragments, or file paths to the client.
