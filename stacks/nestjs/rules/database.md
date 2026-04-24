---
description: Database access patterns for NestJS with Prisma/TypeORM
alwaysApply: false
paths:
  - "src/**/*.repository.ts"
  - "prisma/**"
  - "migrations/**"
---

## Migrations

**Don't:** Edit or delete an existing migration that has been applied to any environment (dev, staging, production). Never use `prisma migrate reset` in production.
**Do:** Always create a new migration for schema changes (`npx prisma migrate dev --name descriptive-name`). Treat applied migrations as immutable history. Review generated SQL before applying. For TypeORM, use `migration:generate` and inspect the output.
**Why:** Modifying applied migrations causes schema drift between environments. Prisma tracks migration history — altering it breaks `prisma migrate deploy` in CI/CD.

## Query Patterns

**Don't:** Query inside loops (`for (const user of users) { await prisma.order.findMany({ where: { userId: user.id } }) }`). Don't use `findMany()` without pagination on unbounded tables.
**Do:** Use Prisma `include` or `select` for eager loading related data. Batch lookups with `WHERE id IN (...)` via `findMany({ where: { id: { in: ids } } })`. Add `take`/`skip` or cursor-based pagination to list endpoints. For TypeORM, use `createQueryBuilder` with `.leftJoinAndSelect()`.
**Why:** N+1 queries are the most common performance bug. 100 users with orders = 101 queries instead of 2. Unbounded `findMany` on a million-row table crashes the server.

## Transactions

**Don't:** Make HTTP calls, send emails, or do slow I/O inside an open transaction. Don't nest transactions without understanding savepoint behavior.
**Do:** Gather all external data first, then wrap only the database writes in `prisma.$transaction()` or TypeORM's `queryRunner`. Keep transactions as short as possible. Use interactive transactions (`prisma.$transaction(async (tx) => { ... })`) when writes depend on reads.
**Why:** Long-held transactions lock rows and starve the connection pool. Under concurrent load, this cascades into request timeouts and deadlocks.

## Connection Pooling

**Don't:** Create multiple `PrismaClient` instances or open unbounded concurrent queries (`Promise.all(thousands.map(query))`).
**Do:** Use a single `PrismaService` extending `PrismaClient` that implements `OnModuleInit` and calls `$connect()` in `onModuleInit`. Set `connection_limit` in the Prisma connection string matching your database's pool capacity. For high-concurrency workloads, use bounded concurrency (e.g., `p-limit`) to avoid exhausting the pool.
**Why:** Each `PrismaClient` instance creates its own connection pool. Multiple instances waste connections. Exceeding pool limits causes timeouts that cascade into 500 errors.
