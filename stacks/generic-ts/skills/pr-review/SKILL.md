---
name: pr-review
description: Review code changes — delegates to specialist agents for code quality, security, performance, and documentation.
argument-hint: "[staged | file path | branch name — or omit to auto-detect]"
disable-model-invocation: true
---

Review code changes by delegating to specialist agents and synthesizing a unified report. Works with branch diffs, staged changes, or specific files.

## Step 1: Determine Scope

Parse `$ARGUMENTS` to determine what to review:

- **`staged`**: review `git diff --cached`. If nothing staged, fall back to `git diff`.
- **File path**: review that specific file's current state.
- **Branch name**: review `git diff main...<branch>` (or `master...<branch>` — detect the default branch).
- **No argument**: review changes on the current branch vs main: `git diff main...HEAD`. If no branch diff, fall back to `git diff --cached` (staged), then `git diff` (unstaged).

If there are no changes to review, say so and stop.

## Step 2: Code Review (delegate to agents)

1. **Always**: delegate the diff to `@code-reviewer`
2. **If security-sensitive code changed** — auth middleware/guards, input handling (controllers, route handlers, Server Actions, tRPC procedures), DB queries (Prisma/Drizzle/Knex), token/JWT/session code, file path construction, cryptography, CORS / CSP configuration, dependency additions: delegate to `@security-reviewer`
3. **If performance-sensitive code changed** — endpoints, DB queries, loops over collections, caching, connection pools, React renders / memoization, Server Components, bundle size, streams, WebSocket handlers: delegate to `@performance-reviewer`. Skip if changes are only docs, config, tests, or static assets.
4. **If runtime/async-sensitive code changed** — async/await, Promises, streams, event emitters, workers, timers, AbortController, lifecycle (startup/shutdown): delegate to `@runtime-reviewer`
5. **If documentation changed** — .md files, significant TSDoc/JSDoc changes, OpenAPI / Swagger specs, README, API docs: delegate to `@doc-reviewer`

Determine relevance by reading the diff content, not just file paths.

## Step 3: Synthesize Report

For branch reviews:
```
## Branch Review: [branch-name]

**Base**: [base] → **Head**: [head] | **Changed**: [N files, +X/-Y lines] | **Commits**: [N]

### Code Review
#### Critical / High
- [Agent] File:Line — issue

#### Medium
- [Agent] File:Line — issue

#### Low
- [Agent] File:Line — issue

### Verdict
[Ready to merge / Needs changes — summarize blockers]
```

For staged/file reviews:
```
## Review Summary

**Scope**: [staged changes / file path]
**Agents run**: [list]

### Critical / High
- [Agent] File:Line — issue

### Medium / Low
- [Agent] File:Line — issue

### Passed
- [areas with no issues]
```

Deduplicate findings that overlap between agents. Attribute each finding to the agent that found it.
