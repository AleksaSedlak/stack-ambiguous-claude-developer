---
description: Testing patterns for go
alwaysApply: true
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Principles

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write tests that assert implementation details (mock call counts, internal state).
**Do:** Assert observable behavior — given this input, expect this output or side effect.
**Why:** Implementation-coupled tests break on every refactor without catching real bugs.
<!-- /EXAMPLE -->

## Naming

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Name tests `it('should work')` or `it('works correctly')`.
**Do:** Name tests as behavior sentences: `it('returns 404 when user does not exist')`.
**Why:** When a test fails in CI, the name is all you see. It must tell you what broke without reading the code.
<!-- /EXAMPLE -->

## Structure

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Mix setup, action, and assertions throughout the test body.
**Do:** Use Arrange-Act-Assert: clear setup block, single action, then assertions.
**Why:** AAA structure makes tests scannable — you can instantly see what's being tested and what's expected.
<!-- /EXAMPLE -->

## Mocking

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Mock the module under test, or deep-mock collaborators with complex return setups.
**Do:** Mock only at system boundaries (HTTP, DB driver, filesystem, clock). Use real implementations for everything else.
**Why:** Over-mocking creates tests that pass with broken code. Boundary mocks catch real integration issues.
<!-- /EXAMPLE -->

## Coverage

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Target 100% line coverage with synthetic assertions that don't verify behavior.
**Do:** Cover happy path, error paths, and edge cases for each public function. Coverage is a symptom of good tests, not a goal.
**Why:** A test that hits a line without asserting its behavior is a false signal — it gives confidence without evidence.
<!-- /EXAMPLE -->
