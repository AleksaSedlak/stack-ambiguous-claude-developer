---
description: Code quality patterns for go
alwaysApply: true
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Principles

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write functions that do multiple things separated by blank lines or section comments.
**Do:** Extract each responsibility into a named function. If you can't name it without "and", split it.
**Why:** Small functions are testable, reusable, and readable. Large functions hide bugs in their middle.
<!-- /EXAMPLE -->

## Language/Type Safety

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use `any` or equivalent to silence a type error.
**Do:** Use the language's narrowing/pattern-matching to handle all cases explicitly.
**Why:** Type erasure at runtime means the compiler is your only safety net — bypassing it invites production crashes.
<!-- /EXAMPLE -->

## Naming

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use abbreviations like `usr`, `btn`, `mgr`, `svc` in identifiers.
**Do:** Use full words: `user`, `button`, `manager`, `service`. Only abbreviate universally known terms (`id`, `url`, `api`, `db`).
**Why:** Code is read 10x more than written. Saving 3 characters costs every future reader a mental lookup.
<!-- /EXAMPLE -->

## Patterns

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use sequential awaits on independent async operations.
**Do:** Use concurrent execution (Promise.all, Task.async_stream, goroutines) for independent work.
**Why:** Sequential awaits double/triple latency for no reason when operations don't depend on each other.
<!-- /EXAMPLE -->

## Comments

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write comments that restate what the code does (`// increment counter`).
**Do:** Comment WHY — non-obvious decisions, workarounds with issue links, algorithm rationale.
**Why:** The code already says what. Comments that restate it become lies when the code changes.
<!-- /EXAMPLE -->
