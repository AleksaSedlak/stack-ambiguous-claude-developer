---
paths:
  - "src/**/*.controller.ts"
  - "src/**/*.guard.ts"
  - "src/**/*.interceptor.ts"
  - "src/**/*.pipe.ts"
  - "src/**/*.filter.ts"
  - "src/**/*.middleware.ts"
  - "src/**/auth/**"
  - "src/**/common/**"
  - "src/main.ts"
---

# Security rules (NestJS)

## Input validation

- Every HTTP input has a DTO with `class-validator` decorators. `ValidationPipe`
  is enabled globally with `{ whitelist: true, forbidNonWhitelisted: true, transform: true }`.
- Never accept raw `req.body` into a service. Validate at the controller boundary.
- For query/path params, use `ParseIntPipe`, `ParseUUIDPipe`, `ParseBoolPipe`, etc.
  Don't manually `Number(req.params.id)`.
- Max lengths on every string. Max array sizes on every list. Whitelist enums.

## SQL injection

- Never concatenate or interpolate user input into raw SQL. This is an instant
  critical finding.
- Prisma: use `where: { ... }`, `findFirst`, `findUnique`. If you must drop to
  raw, use `$queryRaw`\`...\` (tagged template — parameterized) — never
  `$queryRawUnsafe`.
- TypeORM: use the query builder (`.where('x = :x', { x })`) or repository
  methods. Never concatenate into `query()`.
- Drizzle: use the query builder and `sql`\`\` template — never `sql.raw()` on
  anything derived from input.

## Authentication

- NestJS auth lives in a `AuthModule` + `AuthGuard`. Controllers opt in via
  `@UseGuards(AuthGuard('jwt'))` (or an app-wide `APP_GUARD`).
- JWT: specify `algorithms: ['HS256']` (or RS256) explicitly in verify options.
  Never accept `alg: none`. Pin the algorithm list.
- Use `@nestjs/jwt` / `passport-jwt`, not hand-rolled JWT parsing.
- Token secret from `ConfigService`, validated at startup. Never hardcoded.
- Short access token TTL (15 min). Refresh tokens in a httpOnly, secure,
  sameSite=lax cookie — not localStorage.

## Password storage

- Use `argon2` (preferred) or `bcrypt`. Never MD5, SHA1, SHA256, or plain.
- Hash in a service, never in a controller.
- On login, compare with the library's constant-time compare. Do not early-return
  on "user not found" vs "wrong password" — same error, same timing, to prevent
  user enumeration.

## Authorization

- Auth ≠ authZ. Even after login, every resource access must check ownership or role.
- Use `@UseGuards(RolesGuard)` + `@Roles('admin')` or the CASL integration.
- Never trust `userId` from the request body — always from the authenticated
  principal (`@CurrentUser()` or `req.user`).
- Row-level: filter `WHERE user_id = :currentUser.id` in the repository — don't
  rely on the caller remembering to scope.

## Mass assignment

- Never spread `req.body` into an ORM update:
  ```ts
  // BAD
  await this.prisma.user.update({ where: { id }, data: req.body });
  ```
- The DTO (with `whitelist: true`) is your mass-assignment guard. If the DTO
  doesn't declare a field, it gets stripped — assuming `ValidationPipe` is on.
- Explicitly exclude fields that must never be client-editable: `role`,
  `isAdmin`, `balance`, `userId`, `tenantId`. Use `@Exclude()` on the DTO or a
  separate `UpdateXByAdminDto`.

## Secrets & config

- All secrets from `ConfigService`. Validate with Joi / Zod at module init:
  ```ts
  ConfigModule.forRoot({ validationSchema: Joi.object({
    JWT_SECRET: Joi.string().min(32).required(),
    DATABASE_URL: Joi.string().uri().required(),
  }) })
  ```
- `.env` is gitignored. `.env.example` is committed with dummy values for every
  required key.
- Never log secrets, JWTs, passwords, or full request bodies at `info` level.
  Configure pino / winston redaction for `authorization`, `cookie`, `password`,
  `token`, `secret`.

## Command / code injection

- No `eval`, `new Function(...)`, `vm.runInNewContext(userInput, ...)`.
- No dynamic `require()` or `import()` on a path derived from user input.
- No `child_process.exec(cmd)` where `cmd` is built from user input. Use
  `execFile(bin, [...args])` with an argv array — no shell interpretation.
- No `fs.readFile(path.join(base, userInput))` without path normalization +
  containment check — path traversal (`../../etc/passwd`).

## File uploads

- Use `@nestjs/platform-express` or `@nestjs/platform-fastify` multer/busboy.
- Enforce size limits (`limits: { fileSize: N }`). Whitelist MIME types via
  `FileTypeValidator`. Never trust the client-provided MIME or extension —
  sniff the first bytes.
- Store with a server-generated filename, never the user-supplied name.
- Scan for malware before serving back (ClamAV, S3 scanning).

## Timing attacks

- String compare of tokens, session IDs, or HMAC signatures uses
  `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))` — never `===`.
- Buffers must be the same length before `timingSafeEqual` — pad or early-reject
  at a length check.

## CORS / security headers

- Use `helmet()` middleware for default security headers.
- Configure CORS narrowly: `origin: [allowlist]`, not `origin: '*'` for
  authenticated APIs. If you send cookies, `credentials: true`.
- Content Security Policy: define `default-src 'self'` and allowlist from there.

## Dependencies

- Every new dependency is a trust decision. Prefer well-maintained, widely-used
  packages over an obscure one with 3 stars.
- Run `npm audit` / `pnpm audit` before merge. Fix high/critical.
- Pin exact versions or use `~` for patch-only. Avoid `^` on security-critical
  packages (jwt, bcrypt, argon2).

## SSRF

- If the service fetches a user-provided URL (webhook forwarding, URL preview):
  - Resolve DNS first, reject private ranges (`10.*`, `172.16-31.*`, `192.168.*`,
    `127.*`, `169.254.*`, IPv6 equivalents).
  - Allowlist protocols (`http`, `https` only — no `file://`, `gopher://`, `ftp://`).
  - Use a fetch client with a low timeout and redirect limit.

## Logging

- Never log full request body for endpoints that receive passwords, tokens, or PII.
- Structured logs only (pino/winston JSON), with redaction configured.
- Include a request ID in every log line so a single user action is traceable.
