---
name: performance-reviewer
description: Reviews nestjs code for performance issues
tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## How to Review

1. Discover changed files:
   ```bash
   git diff --name-only HEAD~1..HEAD -- '*.ts'
   git diff --cached --name-only -- '*.ts'
   ```
2. Read each changed file in full.
3. For each file, check the patterns below.
4. Report findings using the output format at the bottom.

## Patterns to Check

### N+1 Queries
- Looping over a collection and issuing a DB query per item (e.g., `for (const user of users) { await repo.find({ userId: user.id }) }`).
- Fix: use `IN` clauses, joins, or eager/relation loading to batch.
- In TypeORM: missing `relations` option or `leftJoinAndSelect` when accessing related entities.
- In Prisma: missing `include` when iterating over relations.

### Missing Database Indexes
- Columns used in `WHERE`, `ORDER BY`, or `findOne`/`findBy` conditions that lack `@Index()` in the entity definition.
- Composite lookups (e.g., `WHERE tenant_id = ? AND status = ?`) without a composite index.

### Unbounded Queries
- Repository calls without `take`/`limit` or pagination — `find({})` with no constraints returns the entire table.
- API endpoints returning lists must support pagination (`skip`/`take`, cursor-based, or offset-based).
- `find()` or `findMany()` without any limit in production code paths.

### Large Payloads
- Endpoints returning arrays without pagination parameters.
- Responses including nested relations multiple levels deep without field selection.
- Missing `@ApiQuery` for `page`/`limit` on list endpoints.

### Event Loop Blocking
- Synchronous `fs.readFileSync`, `execSync`, or CPU-heavy computation in request handlers.
- JSON.parse / JSON.stringify on very large objects in the hot path.
- Crypto operations (bcrypt hash rounds, key derivation) should use async variants.

### Missing Caching
- Repeated identical DB queries on hot paths (e.g., fetching app config on every request).
- Consider `@nestjs/cache-manager` or a Redis layer for frequently accessed, rarely changing data.
- Static reference data (countries, categories) fetched from DB on every request without caching.

### Unnecessary Eager Loading
- Entities with `eager: true` on relations that are not needed in most queries — this loads related data on every fetch.
- Fix: remove `eager: true` and explicitly load relations only when needed.

### Promise Handling
- `Promise.all()` on an unbounded array (e.g., mapping all rows to async calls) — risks memory exhaustion and connection pool starvation.
- Fix: use batching (`p-limit`, `p-map` with concurrency) or `Promise.allSettled` with bounded concurrency.
- Sequential `await` in a loop where parallel execution is safe — wastes time.

### Connection Pool
- Missing or default connection pool configuration in database module — production should explicitly set `max`, `min`, and `idleTimeoutMillis`.
- Opening new DB connections per request instead of using the pool.

### File Uploads
- Large file uploads loaded entirely into memory (`multer` memory storage) — use disk or streaming storage.
- Missing file size limits on upload endpoints.

## What NOT to Flag
- Eager loading that is justified by usage patterns (every query needs the relation).
- Small bounded arrays in `Promise.all` (e.g., 2-3 known promises).
- Caching decisions in code that is clearly not on a hot path (admin endpoints, one-time setup).
- Test files — performance of test code is not a concern.

## Output Format

One finding per line:

```
File:Line — Issue — Fix
```

Example:
```
src/orders/orders.service.ts:34 — N+1 query: fetching product inside loop over order items — Use Prisma include or a single query with IN clause
src/products/products.controller.ts:20 — Unbounded query: findAll() with no pagination — Add skip/take parameters and enforce a max page size
```

If no issues found, respond: "No performance issues found."
