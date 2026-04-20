---
paths:
  - "prisma/**"
  - "drizzle/**"
  - "migrations/**"
  - "db/migrations/**"
  - "src/**/migrations/**"
  - "knexfile.*"
  - "drizzle.config.*"
---

# Database & Migrations

## Golden Rules

- **Never modify an existing migration** — always create a new one. Migrations that already
  ran in production are immutable history. Amending them causes schema drift and cryptic
  production incidents.
- Every migration must be reversible (have a working `down` / rollback), or be explicitly
  marked irreversible with a reason in the PR description.
- Test migrations in both directions locally before committing: apply, rollback, re-apply.
- Run one logical change per migration. Mixing "add column" + "backfill data" + "drop
  column" in one migration makes rollback impossible.

## Schema Changes

- Add indexes in a separate migration from schema changes. Indexes may take a long time on
  large tables — easier to roll back independently.
- For large tables, use **online** index creation:
  - Postgres: `CREATE INDEX CONCURRENTLY` (not wrapped in a transaction)
  - MySQL: `ALGORITHM=INPLACE, LOCK=NONE` when supported
- Adding a `NOT NULL` column to an existing large table is a two-step deploy:
  1. Add nullable column + backfill
  2. Apply `NOT NULL` constraint in a later migration
- Never drop a column or table without first confirming: (a) deployed code doesn't
  reference it, (b) data is no longer needed. Do it in two deploys — first remove code
  references, then drop.

## Data & Backfills

- Never seed production data in migration files. Use a dedicated script or admin tool.
- Backfills on large tables must run in batches with a limit and progress logging — never
  `UPDATE users SET ...` against millions of rows in one statement.
- Backfills go in their own migration or a separate one-shot script, never mixed with
  schema changes.

## Transactions

- Operations that must succeed or fail together wrap in a transaction:
  - Prisma: `prisma.$transaction([...])` or `prisma.$transaction(async tx => { ... })`
  - Drizzle: `db.transaction(async tx => { ... })`
  - Knex: `db.transaction(trx => { ... })`
- Never hold a transaction open while doing HTTP calls, file I/O, or other slow work —
  connections are scarce and you'll starve the pool.
- Long-running writes should be idempotent and chunked — no "10-second transaction" that
  locks a table.

## ORM-Specific Notes

### Prisma
- Schema is the source of truth. Run `prisma migrate dev` locally to generate migrations,
  `prisma migrate deploy` in CI/prod — never edit a generated SQL file to "fix" it.
- `$queryRaw` is parameterized-safe; `$queryRawUnsafe` is not — avoid it.
- Eager-load relations with `include:` or `select:` — lazy loading doesn't exist; a
  missing relation access is a separate query, i.e. N+1.

### Drizzle
- Keep the schema and migrations in version control. `drizzle-kit generate` produces
  migrations; commit both the schema diff and the SQL.
- Use the query builder or tagged-template `sql` helper with placeholders — never string
  interpolate user input.

### Knex / TypeORM / Sequelize
- Use the migration CLI. Hand-written raw SQL migrations only when the DSL can't express
  the change.

## Indexes & Query Hygiene

- Every column used in a `WHERE`, `JOIN`, or `ORDER BY` on a frequently-queried table
  should have an index. Grep the codebase for query shapes and compare to migration files.
- Composite indexes for multi-column filters. Leftmost-prefix rule: `(a, b)` covers `a`
  and `a, b`, not `b`.
- Partial indexes for "most rows are irrelevant" queries (`WHERE status = 'active'`).

## Timestamps & Soft Delete

- Every table gets `created_at` and `updated_at`. Use the DB default (`DEFAULT
  CURRENT_TIMESTAMP`) or ORM hooks — consistent across the app.
- Soft delete (`deleted_at`) is a policy decision. If used, every query must filter it
  out by default — consider a middleware/guard at the ORM level rather than per-query.
