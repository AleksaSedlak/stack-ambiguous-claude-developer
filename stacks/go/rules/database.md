---
description: Database access patterns for go
alwaysApply: false
paths:
  - "src/repositories/**"
  - "src/models/**"
  - "prisma/**"
  - "migrations/**"
  - "src/db/**"
---

<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->

## Migrations

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Modify an existing migration that has been applied to any environment.
**Do:** Always create a new migration for schema changes. Treat applied migrations as immutable history.
**Why:** Modifying a migration that's been run elsewhere causes schema drift — staging and production diverge silently.
<!-- /EXAMPLE -->

## Query Patterns

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Call the database inside a loop (`for user in users: db.get_orders(user.id)`).
**Do:** Batch queries (`WHERE id IN (...)`) or use eager loading / joins / includes.
**Why:** N+1 queries are the most common performance bug in data-backed apps. 100 users = 101 queries instead of 2.
<!-- /EXAMPLE -->

## Transactions

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Do HTTP calls or slow I/O inside an open transaction.
**Do:** Keep transactions short — gather data outside, then wrap only the writes in a transaction.
**Why:** Long-held transactions starve the connection pool and can cause deadlocks under concurrent load.
<!-- /EXAMPLE -->

## Connection Pooling

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Open unbounded concurrent database calls (`Promise.all(thousands.map(query))`).
**Do:** Use bounded concurrency (pool size limits, p-limit, semaphores) matching your connection pool.
**Why:** Exceeding pool size causes connection timeouts that cascade into request failures.
<!-- /EXAMPLE -->
