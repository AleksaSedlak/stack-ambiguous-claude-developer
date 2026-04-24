---
description: Security patterns for NestJS
alwaysApply: false
paths:
  - "src/**"
---

## Input Validation

**Don't:** Trust client-provided data because TypeScript types say it's safe — types do not exist at runtime. Never skip validation on "internal" endpoints.
**Do:** Apply `ValidationPipe` globally with `whitelist: true` and `forbidNonWhitelisted: true`. Decorate every DTO property with class-validator decorators (`@IsString()`, `@IsEmail()`, `@IsInt()`, `@MaxLength()`). Validate path params and query params with dedicated DTOs or NestJS built-in pipes (`ParseIntPipe`, `ParseUUIDPipe`).
**Why:** Unvalidated input is the entry point for injection, overflow, and logic bugs. Global `ValidationPipe` ensures nothing slips through.

Additional guidelines:
- Use `@Transform()` from class-transformer to sanitize strings (trim whitespace, normalize emails)
- Apply `@MaxLength()` to all string fields — unbounded strings enable denial-of-service via memory exhaustion
- For file uploads, validate MIME type, file size, and filename server-side — never trust the client's Content-Type header
- Validate array lengths with `@ArrayMaxSize()` to prevent batch endpoint abuse

## Injection Prevention

**Don't:** Use Prisma `$queryRaw` or `$executeRaw` with template literal interpolation of user input. Never use `eval()`, `new Function()`, or `child_process.exec()` with user-provided strings.
**Do:** Use Prisma's parameterized queries exclusively — `$queryRaw` with tagged template literals (`Prisma.sql`) is safe; string concatenation is not. For TypeORM, use parameterized `createQueryBuilder` or repository methods. Sanitize any values passed to `$queryRawUnsafe` (better yet, never use it).
**Why:** SQL injection via `$queryRawUnsafe` with interpolated strings is the most exploitable vulnerability in a NestJS/Prisma stack. One unparameterized query = full database compromise.

Additional guidelines:
- For dynamic column names or sort orders, validate against an allowlist of known column names — never interpolate user input into ORDER BY or column selection
- If shell commands are unavoidable, use `child_process.execFile()` with an argv array instead of `exec()` with a command string
- Never construct regex from user input without escaping — use a library like `escape-string-regexp`

## Authentication

**Don't:** Roll your own JWT validation, session management, or OAuth flow from scratch. Don't store tokens in localStorage.
**Do:** Use `@nestjs/passport` with strategy classes (`JwtStrategy`, `LocalStrategy`). Store JWT tokens in httpOnly, secure, sameSite cookies. Use `@nestjs/jwt` for token signing/verification. Apply `AuthGuard` globally or per-route. Set short token expiry with refresh token rotation.
**Why:** Hand-rolled auth has subtle timing attacks, token validation gaps, and storage vulnerabilities that Passport strategies have already solved.

Additional guidelines:
- Use `@Public()` decorator (custom `SetMetadata`) to explicitly mark unauthenticated routes rather than skipping the guard
- Implement rate limiting on auth endpoints (`@nestjs/throttler`) to prevent brute-force attacks
- Hash passwords with bcrypt (cost factor >= 12) — never use MD5, SHA-1, or plain SHA-256 for passwords
- Log authentication failures with IP and user agent for audit trails

## Authorization

**Don't:** Fetch resources by ID without verifying ownership or role (`prisma.order.findUnique({ where: { id } })`).
**Do:** Implement RBAC with custom guards and decorators (`@Roles('admin')`, `@SetMetadata('roles', [...])`). Always scope data queries by the authenticated user (`where: { id, userId: req.user.id }`). Use CASL or a policy engine for complex permission models. Check authorization in guards, not in service logic.
**Why:** IDOR (Insecure Direct Object Reference) is the most common authorization flaw. Knowing an ID should never grant access — every query must be scoped.

Additional guidelines:
- For multi-tenant apps, apply tenant scoping at the repository/service layer so controllers cannot forget it
- Validate that the authenticated user has access to every referenced resource ID in the request body, not just the URL parameter
- Never expose sequential/guessable IDs in URLs — use UUIDs for public-facing resource identifiers
- Separate authentication (who are you?) from authorization (what can you do?) into distinct guards
- Write unit tests for every guard to verify that unauthorized access is blocked — do not rely on e2e tests alone
- Log authorization failures with the user ID, requested resource, and required role for security auditing

## Secrets

**Don't:** Scatter `process.env.SECRET` calls throughout services and controllers. Don't commit `.env` files or hardcode secrets.
**Do:** Use `@nestjs/config` with `ConfigService` as the single source for all configuration. Validate environment variables at startup using Joi or Zod schema in `ConfigModule.forRoot({ validationSchema })`. Inject `ConfigService` wherever config is needed. Fail fast on missing or invalid secrets.
**Why:** Centralized config makes secrets auditable, testable (mock `ConfigService`), and impossible to accidentally log. Startup validation prevents deploying with missing credentials.

Additional guidelines:
- Use separate `.env.example` file (committed) documenting all required variables without values
- Rotate secrets on a schedule and after any team member departure
- Never log configuration values at startup — log only which keys are present/missing

## Dependencies

**Don't:** Install packages without checking maintenance status, known CVEs, or download counts. Don't leave `npm audit` warnings unresolved.
**Do:** Run `npm audit` in CI and fail the build on high/critical vulnerabilities. Pin versions for security-critical packages (`passport`, `jsonwebtoken`, `bcrypt`, `helmet`). Review new dependencies before adding — check last publish date, maintainer count, and open issues. Use `helmet` middleware for HTTP security headers.
**Why:** Supply chain attacks target unmaintained packages. One compromised transitive dependency in your NestJS app = full server access.

Additional guidelines:
- Enable `helmet()` in `main.ts` for security headers (X-Frame-Options, CSP, HSTS)
- Enable CORS with explicit allowed origins — never use `origin: '*'` in production
- Use `@nestjs/throttler` to apply rate limiting globally and protect against abuse
- Review `package-lock.json` diffs in PRs for unexpected transitive dependency changes
- Keep NestJS core packages (`@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`) on the same major version to avoid incompatibilities
- Remove unused dependencies regularly — each unused package is attack surface with no benefit
