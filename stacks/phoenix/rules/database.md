---
paths:
  - "priv/repo/migrations/**"
---

# Database Migrations

- **Never modify an existing migration** — always create a new one. Existing migrations may have already run in production.
- Every migration must be reversible — implement both `up/down` or use `change/0` only when Ecto can infer the reverse automatically.
- Test migrations in both directions before committing: `mix ecto.migrate` then `mix ecto.rollback`.
- Use Ecto's migration DSL (`create table`, `alter table`, `add`, `remove`) when it covers the operation. Use `execute/1` with raw SQL only when the DSL does not — complex constraints, custom types, triggers.
- Never seed production data in migration files — use `priv/repo/seeds.exs` or a dedicated task.
- Never drop columns or tables without first confirming the data is no longer needed and deployed code no longer references them.
- Add indexes in their own migration, separate from schema changes — easier to roll back independently.
- Every new schema must include `timestamps()` — this adds `inserted_at` and `updated_at` automatically.
- Use `Repo.transaction/1` for operations that must succeed or fail together — never perform multi-step writes outside a transaction.
