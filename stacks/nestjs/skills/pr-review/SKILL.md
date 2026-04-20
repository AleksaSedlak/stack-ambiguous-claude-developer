---
name: pr-review
description: Review code changes — delegates to specialist agents for code quality, security, and performance.
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

1. **Always**: delegate the diff to `@code-reviewer`. This agent also covers
   documentation (TSDoc/JSDoc accuracy, README consistency, `.env.example` /
   code mismatches).
2. **If security-sensitive code changed** — auth guards, input handling
   (controllers, DTOs, pipes), DB queries (Prisma / TypeORM / Drizzle),
   token / JWT / session code, file path construction, cryptography,
   CORS configuration, new dependencies: delegate to `@security-reviewer`.
3. **If performance-sensitive code changed** — endpoints, DB queries, loops
   over collections, caching, connection pools, streams, WebSocket handlers:
   delegate to `@performance-reviewer`. Skip for pure docs/config/test/asset diffs.
4. **Opt-in: `@runtime-reviewer`** — only delegate when the diff touches async
   orchestration at a non-trivial level: streams, worker threads, event emitters,
   manual `AbortController` wiring, timers, lifecycle hooks
   (`onModuleInit` / `onApplicationShutdown`), bull/bullmq jobs, raw `Promise`
   plumbing. For routine `async/await` in a controller or service, skip it —
   `@code-reviewer` already covers that.

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
