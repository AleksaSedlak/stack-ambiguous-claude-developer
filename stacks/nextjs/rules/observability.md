---
description: Observability patterns — logging, metrics, correlation IDs
paths:
  - "src/**"
  - "app/**"
  - "server/**"
  - "api/**"
---

# Observability

- Every request handler logs: request received (with correlation ID), response sent
  (with status code + duration ms).
- Every external call (DB, HTTP, queue publish) should emit timing via structured log
  or metrics.
- Propagate a correlation ID (request ID) through the entire call chain — pass it to
  loggers, downstream HTTP headers (`X-Request-Id`), queue message metadata.
- Never use `console.log` in production code. Use a structured logger (pino, winston)
  with JSON output and a configured redact list for sensitive fields.
