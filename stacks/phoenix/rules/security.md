---
paths:
  - "lib/**_web/controllers/**"
  - "lib/**_web/live/**"
  - "lib/**_web/plugs/**"
  - "lib/**_web/router.ex"
  - "lib/**_web/endpoint.ex"
---

# Security

## Input Validation

- Validate all user input at the system boundary. Never trust request parameters.
- Use `cast/3` with an explicit list of allowed fields — never cast all params blindly.
- Never use `String.to_atom/1` on user input or external data — atoms are not garbage collected and can exhaust memory. Use `String.to_existing_atom/1` or pattern match on known values.

## SQL

- Ecto parameterizes queries automatically — never use string interpolation inside `Repo.query/2` or `fragment/1`.
- `where: [field: ^value]` is safe. `where: fragment("field = '#{value}'")` is not.

## Output & XSS

- Phoenix and HEEx escape output automatically — never use `raw/1` or `Phoenix.HTML.raw/1` on user-supplied content.

## Authentication

- Never write raw OAuth redirect logic manually — use the project's auth library (Assent).
- All user and session logic goes through the `Accounts` context — never inline in controllers or LiveViews.
- Store `current_user` in the session via `put_session/3` and expose to LiveViews via an `on_mount` hook.
- Protect routes with pipeline plugs, not ad-hoc checks inside individual controllers.

## Sessions & Tokens

- Sessions must be signed (`Plug.Crypto`). Sensitive sessions should also be encrypted.
- Auth tokens must be short-lived. Never store refresh tokens in the browser.
- Use `Plug.Crypto.secure_compare/2` for constant-time comparison of secrets and tokens — never `==`.

## LiveView

- LiveView assigns are accessible to the client through the socket. Never put secrets, tokens, or sensitive data in assigns.
- Always validate auth in `on_mount` — do not rely on the initial HTTP request being protected.

## Secrets & Logging

- All secrets and credentials come from environment variables via `runtime.exs`. Never hardcode in config files.
- Never log secrets, tokens, passwords, or PII. Censor sensitive fields before logging params.
- Rate-limit authentication endpoints.
