---
description: API/handler patterns for go
alwaysApply: false
paths:
  - "src/controllers/**"
  - "src/routes/**"
  - "app/api/**"
  - "src/handlers/**"
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Request Handling

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Put business logic directly in route handlers / controllers.
**Do:** Keep handlers thin — parse input, call a service, format output. Logic lives in services.
**Why:** Thin handlers are testable without HTTP, reusable across transports, and easy to review.
<!-- /EXAMPLE -->

## Input Validation

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Trust request body shapes because your types say so — types are erased at runtime.
**Do:** Validate every input with a runtime schema (Zod, class-validator, Pydantic, etc.) at the handler boundary.
**Why:** Unvalidated input is the #1 source of injection, crashes, and data corruption.
<!-- /EXAMPLE -->

## Response Formatting

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Return raw database entities as API responses.
**Do:** Define response DTOs/shapes that expose only what clients need. Never leak internal fields (password hashes, internal IDs, audit timestamps).
**Why:** Coupling responses to DB schema means every schema change is a breaking API change.
<!-- /EXAMPLE -->

## Error Responses

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Return stack traces, SQL fragments, or internal file paths in error responses.
**Do:** Map errors to a consistent shape (`{ code, message }`) in one place (error middleware / exception filter).
**Why:** Verbose errors are an information leak to attackers and useless to API consumers.
<!-- /EXAMPLE -->
