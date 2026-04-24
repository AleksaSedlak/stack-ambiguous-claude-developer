---
description: Error handling patterns for go
alwaysApply: false
paths:
  - "src/**"
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Error Classes

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Throw bare strings, numbers, or plain objects as errors.
**Do:** Define typed error classes with stable codes. Extend from the language's base Error class.
**Why:** Typed errors enable pattern matching in catch blocks and structured logging. Bare strings lose stack traces.
<!-- /EXAMPLE -->

## Async Error Flow

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Leave async calls unhandled (floating promises, unawaited tasks, fire-and-forget).
**Do:** Every async operation is either awaited, returned, or explicitly caught with error handling.
**Why:** Unhandled rejections crash the process in modern runtimes. Silent failures corrupt state.
<!-- /EXAMPLE -->

## HTTP Boundaries

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Let handlers individually format error responses with inconsistent shapes.
**Do:** Map your error taxonomy to HTTP status codes in ONE place (error middleware / exception filter / error boundary).
**Why:** Consistent error responses make APIs predictable for consumers and logs parseable for operators.
<!-- /EXAMPLE -->

## Logging

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use print/console.log for production error logging. Don't log full request bodies or user objects.
**Do:** Use structured logging (JSON) with named event strings, correlation IDs, and a redact list for sensitive fields.
**Why:** Unstructured logs are unsearchable. Logging secrets or PII violates compliance and creates breach risk.
<!-- /EXAMPLE -->
