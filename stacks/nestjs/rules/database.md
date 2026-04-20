---
paths:
  - "prisma/**"
  - "drizzle/**"
  - "migrations/**"
  - "db/**"
  - "src/**/*.repository.ts"
  - "src/**/*.entity.ts"
  - "src/**/typeorm*"
  - "src/**/prisma*"
  - "ormconfig.*"
---

# Database rules (NestJS)

## Migrations

- **Never modify an existing migration.** Create a new one. An existing migration
  has already run in dev, CI, staging, or prod — changing it silently desyncs
  environments.
- Every schema change is a migration. No "I'll just edit the schema and push."
- Migrations are reversible where possible. Every `up` has a `down`. If the
  migration is truly irreversible (data loss), that must be explicit in the PR.
- Never mix data migrations with schema migrations in the same file. Schema
  first, deploy, then data in a follow-up.

## Online migrations

Long-running or lock-heavy operations need to be online-safe:

- **Add a column** — use nullable or a default. Backfill in a separate
  migration. Make NOT NULL only after backfill is complete.
- **Add an index** — use `CREATE INDEX CONCURRENTLY` (Postgres) or the online
  equivalent. Never block writes on a busy table.
- **Rename a column** — multi-step: add new, backfill + dual-write, switch reads,
  drop old. Never a single-step rename on a live table.
- **Drop a column** — first remove all code references, deploy, then drop in a
  later migration.

## Transactions

- Wrap multi-statement changes in a transaction. Never let two writes that must
  succeed-or-fail-together run separately.
- Prisma: `this.prisma.$transaction([...])` for batch, or
  `this.prisma.$transaction(async (tx) => { ... })` for interactive.
- TypeORM: `dataSource.transaction(async (manager) => { ... })`.
- Don't hold a transaction open across an external HTTP call — that's a
  connection starvation bomb.

## N+1

- Fetch related data in one query, not inside a loop.
- Prisma: `include: { posts: true }` or `select: { posts: { take: 10 } }`.
- TypeORM: `.leftJoinAndSelect('user.posts', 'posts')` or `relations: ['posts']`.
- Drizzle: explicit `join`s or the query builder's `with:`.
- Flag any `Array.map(async x => db.find(x.id))` in review — it's N+1.

## Pagination & unbounded queries

- Every query on a table that can grow has a `limit`. Default reasonable
  (20–100), max capped.
- Never `findMany()` with no filter on a user/auditable table — you'll pull 10M
  rows one day.
- For exports and admin tools, paginate or stream — don't `await
  prisma.user.findMany()` and hold 2GB in memory.

## Indexes

- Every column used in a WHERE clause on a large table gets an index.
- Every foreign key gets an index — the DB doesn't always create one for you.
- Compound indexes are ordered. Index `(tenant_id, created_at)` differs from
  `(created_at, tenant_id)`.
- `EXPLAIN ANALYZE` queries that touch > 1000 rows in a request path.

## Connection pool

- Configure pool size based on the host: usually `num_cpu * 2` for web dynos,
  smaller for serverless.
- Don't open a new client per request — inject the shared service (NestJS DI
  gives you this for free).
- For serverless: use a pooler (pgbouncer, Prisma Accelerate) — direct
  Postgres connections don't survive cold starts.

## Seeding

- Seeds are for dev/test fixtures, never for prod data. Put prod data in a
  migration.
- Idempotent: running seed twice shouldn't break. Use upserts or `ON CONFLICT DO NOTHING`.

## ORM-specific

### Prisma
- `schema.prisma` is the source of truth. All changes via `prisma migrate dev`.
- `@@unique` for business-unique constraints (email, slug). `@@index` for
  query paths. `onDelete: Cascade` vs `SetNull` is a deliberate decision.
- Use `select:` to cut fields you don't need. Don't pull the whole row by default.
- `$queryRaw`\`...\` (tagged) — parameterized, safe. `$queryRawUnsafe` — only
  with validated input and a justification comment.

### TypeORM
- Entities co-locate with the module they belong to. Shared entities go in
  `shared/entities/`.
- Prefer `DataSource.getRepository(Entity)` or injected `@InjectRepository` —
  don't instantiate repositories manually.
- Avoid `synchronize: true` in anything but dev. Use migrations.
- Lazy relations (`Promise<T>`) vs eager (`{ eager: true }`) vs explicit
  `relations: ['x']` — pick one pattern per project.

### Drizzle
- `db/schema.ts` is the source of truth. `drizzle-kit generate` produces
  migrations.
- Query builder by default. `sql`\`\` template for raw fragments — parameterized.
  `sql.raw()` only for trusted static SQL, never user input.
- Use `$with` for CTEs when a query is getting hairy.

## Soft deletes

- If you soft-delete, EVERY query must filter `deletedAt IS NULL` by default.
  Use a default-scoped repository method; don't rely on each caller to remember.
- Add a partial index `WHERE deleted_at IS NULL` on the active-row queries.
