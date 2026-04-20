---
paths:
  - "src/**/controllers/**"
  - "src/**/middleware/**"
  - "src/**/guards/**"
  - "src/**/auth/**"
  - "src/api/**"
  - "app/api/**"
  - "pages/api/**"
  - "server/**"
  - "routes/**"
---

# Security

## Input Validation

- Validate **every** external input at the system boundary — HTTP body/query/params,
  webhook payloads, queue messages, env vars, file uploads. Never trust a shape because
  TypeScript says so; TS types are erased at runtime.
- Use a runtime validator: Zod, Valibot, class-validator, ArkType. Parse on the way in,
  operate on the parsed value only.
- Reject unknown fields by default (`.strict()` in Zod) — don't `.passthrough()` at
  boundaries.
- Enforce length limits on every string input. Unbounded strings are a DoS vector.
- Validate numeric ranges, not just types. `age: z.number()` allows `Infinity` and negatives.

## SQL & ORMs

- Never build SQL with string concatenation or template literals on user input. Use
  parameterized queries:
  - `pg`: `client.query('SELECT ... WHERE id = $1', [id])`
  - Prisma: the query builder is safe by default; `$queryRawUnsafe` is not
  - Drizzle/Knex: bindings (`?`) or the query builder; raw SQL with interpolation is not safe
- If you must build dynamic SQL (e.g., variable `ORDER BY` column), validate against an
  **allowlist** of known column names before interpolating.
- Mass assignment: never spread user input directly into an ORM create/update. Pick fields
  explicitly or parse with a schema first.

```ts
// bad — mass assignment
await db.user.update({ where: { id }, data: req.body });

// good — explicit allowlist
const data = UserUpdateSchema.parse(req.body);
await db.user.update({ where: { id }, data });
```

## Command & Code Injection

- Never pass user input to `child_process.exec`, `execSync`, or shell-interpolated strings.
  Use `spawn`/`execFile` with an **argv array**.
- Never use `eval`, `new Function(...)`, `vm.runInNewContext` on anything derived from
  user input. This is arbitrary code execution.
- `require(userInput)` and dynamic `import(userInput)` are equivalent to `eval` for
  module loading — restrict to allowlists.

## XSS

- React/JSX escapes text by default. `dangerouslySetInnerHTML` is the only common escape
  hatch — never pass user content to it without sanitization (DOMPurify, sanitize-html).
- Never construct HTML via string concatenation on user input.
- URLs: validate protocol before using as a link (`javascript:` URLs are an XSS vector).
  Use `new URL()` and check `url.protocol === 'https:'` / `'http:'`.
- Cookies: `httpOnly: true`, `secure: true`, `sameSite: 'lax'` or `'strict'` by default.

## Prototype Pollution

- `Object.assign(target, userInput)` and spread into an existing object (`{ ...defaults,
  ...userInput }`) can set `__proto__`, `constructor`, or `prototype`. Filter those keys,
  or use `Object.create(null)` for lookup maps.
- Parse JSON and merge libraries (`lodash.merge`) have known prototype-pollution histories
  — pin versions and audit.

## Authentication

- Compare HMAC signatures and webhook secrets with **constant-time** comparison:
  `crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b))`. Required for signature
  verification; use as defense-in-depth for opaque token comparisons behind TLS.
- Passwords: Argon2id (preferred) or bcrypt with a cost factor ≥ 12. Never SHA-256 alone,
  never MD5.
- JWT: use short access tokens (≤ 15 min), refresh tokens rotated on use and revocable.
  Validate `alg` against an explicit allowlist (`RS256` or `HS256`) — never accept `none`.
- Never store refresh tokens in `localStorage`. Use `httpOnly` cookies with CSRF protection.
- Rate-limit authentication endpoints per IP **and** per account.
- OAuth/OIDC: use a library (Auth.js, Passport, Lucia, better-auth). Do not write the
  redirect flow or PKCE handling by hand.

## Authorization

- Check authorization on every request — not just at login. Middleware for coarse-grained,
  service-level checks for row-level (`user.id === resource.ownerId`).
- IDOR: never `db.resource.findUnique({ id })` without also scoping by `ownerId` or
  checking access. If a user knows the ID, they'll try `/resource/42`.
- Default deny on role/permission checks. Missing role ≠ allowed.

## Secrets

- All secrets come from environment variables, loaded through a single typed config
  module. Never `process.env.FOO` scattered through the code — it hides dependencies.
- `.env.example` is committed with dummy values. `.env*` with real values is gitignored.
- Never commit API keys, tokens, private keys, connection strings with credentials.
- Rotate secrets on compromise. If a secret was ever logged or committed, consider it burned.

## SSRF

- If you fetch URLs on behalf of users, validate the resolved IP isn't private
  (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.169.254` —
  the AWS metadata service). Use a library like `ssrf-req-filter` rather than rolling it.
- Never follow redirects blindly — limit redirect count and re-validate each hop.

## CORS & Headers

- Use `helmet` (Express) or equivalent security headers middleware. Set CSP, HSTS,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- CORS: explicit origin allowlist. Never `Access-Control-Allow-Origin: *` combined with
  credentials.

## File Uploads

- Validate MIME type **and** extension, and verify with a magic-number sniff (e.g.,
  `file-type`). The `Content-Type` header is controlled by the client.
- Enforce max size at the parser level, not only after reading.
- Store outside the web root. Never serve user uploads from the same origin as your app
  without `Content-Disposition: attachment` and a sandboxed subdomain.

## Dependencies

- Lockfile committed. Never `--ignore-scripts` turned off globally for install — but be
  aware of post-install scripts in new deps.
- Use `~` (tilde) for security-critical packages — gets patch updates automatically.
  Use `^` (caret) for everything else. Pin exact only when a specific version is audited
  and you'll manually upgrade.
- Run `npm audit` / `pnpm audit` / `yarn audit` in CI. Block on high/critical.
- Consider `snyk` or `socket` for supply-chain monitoring on direct deps.

## Logging & PII

- Never log tokens, passwords, cookies, authorization headers, or full request bodies on
  auth endpoints.
- Redact PII (email, phone, name) from shared log aggregators unless you have a legal
  basis and a retention policy.
- Stack traces and internal error messages stay server-side. Return generic messages to
  clients (`{ code: 'internal_error' }`).
