---
alwaysApply: true
description: How the agent keeps its mental model accurate in long autonomous runs.
---

# Context Discipline

- After 30+ tool calls in a session, re-read any file you're about to edit. Cached understanding is stale.
- After running a fix that changes behavior, re-read the test file to confirm what it actually asserts.
- If you've made 5+ edits to the same file in one session, read it top-to-bottom once to check for inconsistencies you introduced.
- Never assume a function signature hasn't changed if other edits have intervened.
- When you rename or move a symbol, grep for it immediately after the edit to confirm no callers are broken.
- When working across multiple files, verify imports still resolve after any rename.

# Determinism

- Do not rely on `Date.now()`, `Math.random()`, or other non-deterministic values in production code unless the feature explicitly requires it. When required, isolate behind an injectable dependency.
- Test factories and fixtures must produce deterministic output. Sequential IDs, not `crypto.randomUUID()`. Fixed dates, not `new Date()`.
- If code depends on execution order (Promise.race, event ordering, stream scheduling), add a comment explaining the ordering assumption.
- Running the same task prompt against the same codebase state should produce functionally equivalent output. If it wouldn't, the prompt or the code is under-specified — flag it.
