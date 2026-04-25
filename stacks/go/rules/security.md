---
description: Security patterns for go
alwaysApply: false
paths:
  - "src/**"
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Input Validation

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Trust client-provided data without runtime validation — types don't exist at runtime.
**Do:** Parse and validate at every system boundary with a schema library. Reject unknown fields by default.
**Why:** Unvalidated input is the entry point for injection, overflow, and logic bugs.
<!-- /EXAMPLE -->

## Injection Prevention

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Build SQL, shell commands, or templates with string concatenation using user input.
**Do:** Use parameterized queries, argv arrays for shell, and auto-escaping template engines.
**Why:** Injection is the most exploited vulnerability class. One unescaped input = full compromise.
<!-- /EXAMPLE -->

## Authentication

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Roll your own OAuth flow, JWT validation, or session management from scratch.
**Do:** Use established libraries (Passport, Auth.js, Lucia, better-auth, python-jose, etc.). Store tokens in httpOnly cookies.
**Why:** Hand-rolled auth has subtle timing, storage, and validation bugs that libraries have already fixed.
<!-- /EXAMPLE -->

## Authorization

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Fetch a resource by ID without checking ownership or role (`db.findById(req.params.id)`).
**Do:** Always scope queries by the authenticated principal or check access explicitly before returning data.
**Why:** IDOR (Insecure Direct Object Reference) is the most common authorization flaw — knowing an ID shouldn't grant access.
<!-- /EXAMPLE -->

## Secrets

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Scatter `process.env.SECRET` / `os.environ["SECRET"]` calls throughout the codebase.
**Do:** Load all secrets through a single typed config module. Validate at startup. Fail fast on missing secrets.
**Why:** Centralized config makes secrets auditable, testable (mock one module), and impossible to accidentally log.
<!-- /EXAMPLE -->

## Dependencies

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Install packages without checking maintenance status or known vulnerabilities.
**Do:** Run `audit` in CI, pin security-critical packages, and review new deps before adding.
**Why:** Supply chain attacks target unmaintained packages. One compromised transitive dep = full access.
<!-- /EXAMPLE -->
