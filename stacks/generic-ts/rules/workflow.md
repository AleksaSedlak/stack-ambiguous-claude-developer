---
alwaysApply: true
---

# Workflow & Decision Rules

## Dependency Discipline

Before adding a package, check:
1. Does it solve a problem that would take >100 lines to solve correctly in-house?
2. Is it actively maintained (commits in last 6 months, no unpatched critical CVEs)?
3. Is the API surface small enough that you could replace it in a day if abandoned?

If all three: add it. If not: write it yourself or find a smaller alternative.
Never add a dependency for a single utility function.

## When to Stop and Ask vs Proceed

**Stop and ask when:**
- The request is ambiguous and the wrong interpretation would waste significant work
- You're about to delete, rename, or restructure something that affects >5 files
- You're choosing between two valid approaches with different trade-offs the user cares about
- The user's request contradicts an existing rule or convention in this project

**Proceed with assumption when:**
- The choice is cosmetic or easily reversible
- The user gave enough context to infer intent
- Only one reasonable interpretation exists
- The change is additive and self-contained

## AI-Human Disagreement Protocol

If a user's request would introduce a security vulnerability, data loss risk, or clearly
contradict a stated project rule: **state the concern once, briefly, with the specific
risk.** Then do what they asked if they confirm. Never refuse. Never lecture. Never repeat
the warning after acknowledgment.

## Git Commit Convention

Default to Conventional Commits when no existing style is established in the repo:

```
feat: add user registration endpoint
fix: prevent duplicate email signups
refactor: extract validation into shared pipe
chore: update dependencies
docs: document rate limiting behavior
test: add integration tests for auth flow
```

- Subject line under 72 characters, imperative mood ("add" not "added")
- Body explains WHY, not WHAT (the diff shows what)
- Reference issue numbers when they exist: `fix: handle null avatar (#142)`

## Observability Defaults

- Every request handler logs: request received (with correlation ID), response sent
  (with status code + duration ms).
- Every external call (DB, HTTP, queue publish) should emit timing via structured log
  or metrics.
- Propagate a correlation ID (request ID) through the entire call chain — pass it to
  loggers, downstream HTTP headers (`X-Request-Id`), queue message metadata.
- Never use `console.log` in production code. Use a structured logger (pino, winston)
  with JSON output and a configured redact list for sensitive fields.

## File Size Signal

If a file exceeds ~300 lines, consider whether it has multiple responsibilities that
should be separate modules. This is a signal, not a hard limit — a 400-line file with
one cohesive responsibility is fine; a 200-line file with three unrelated concerns
should be split.
