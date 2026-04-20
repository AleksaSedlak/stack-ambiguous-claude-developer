# node_dotclaude — checkpoint (2026-04-19)

Snapshot of where this project sits. Read this first on resume.

## What this is

A NestJS-focused `.claude/` template that personalizes itself to the repo it's
dropped into. A detector script reads the target repo, an applier script fills
machine-editable regions of `CLAUDE.md` and rewrites rule file `paths:`
frontmatter. Works for single-app, monorepo, turbo, nx, and pnpm/yarn/bun
workspaces without code changes.

## Pipeline

```
detect.ts ──JSON──▶ apply.ts --dry-run ──▶ user confirms ──▶ apply.ts --apply
```

Orchestrated by the `setupdotclaude` skill. User is prompted at two decision
points (after detection, after dry-run).

## File inventory

### Top-level

- `CLAUDE.md` — skeleton with `<!-- CLAUDE_REPLACE:key -->` markers for:
  `header`, `apps_overview`, `databases`, `communication`, `commands`,
  `monorepo_commands`, `architecture`, `orm_dir`, `observed_patterns`,
  `key_decisions`. Also includes full Obsidian integration section +
  memory-writing policy with triggers/anti-triggers/file shape.
- `observed-patterns.md` — sits at repo root next to CLAUDE.md. Filled by
  apply.ts with sampled naming convention, DTO location, controller layout,
  injection style, plus the specific files the pattern was derived from.
- `CLAUDE.local.md.example` — stub (unchanged from base template).
- `settings.json` — hooks wired up, Obsidian keys documented.
- `settings.local.json.example` — includes `obsidianVaultPath`,
  `obsidianExclude`, `obsidianAutoReadLimit`.
- `README.md` — template readme (unchanged).
- `.gitignore` — template gitignore (unchanged).

### `scripts/`

- `detect.ts` — schemaVersion 2. Zero dependencies, runs via `npx tsx`.
  Walks workspace globs, builds per-app `AppInfo`, aggregates `databases[]`
  and `communication[]` across apps, samples controller files for observed
  patterns, emits `claudeMdReplacements` for every marker and
  `recommendedRulePathRewrites` / `recommendedDeletes`.
- `apply.ts` — reads stdin or `--input`, gates on schemaVersion 1 or 2,
  fills markers in both `CLAUDE.md` AND `observed-patterns.md`, rewrites
  rule `paths:` frontmatter, applies deletes. Default mode `--dry-run`;
  `--apply` to mutate.

### `skills/`

- `setupdotclaude/` — orchestrator. Runs detect, shows summary via
  AskUserQuestion, runs dry-run, shows plan, applies on confirmation.
  Delegates Obsidian setup to `setup-obsidian` skill.
- `setup-obsidian/` — vault selection and `settings.local.json` writing.
- Others (context, pr-review, tdd, refactor, debug-fix, hotfix, ship,
  explain, test-writer) — unchanged from base template.

### `rules/`

Six files with path-scoped frontmatter: `api.md`, `security.md`,
`database.md`, `code-quality.md`, `error-handling.md`, `testing.md`.
For monorepos, detect.ts appends per-app globs to `api.md`, `security.md`,
`database.md`. `database.md` is deleted if no databases detected.

### `hooks/`

- `session-start.sh` — reads `obsidianVaultPath` from settings.local.json,
  auto-loads top-N (default 3) recent notes from
  `<vault>/Claude/$(basename $PWD)/`, capped at 200 lines each. Silent on
  all failure modes.
- Others unchanged: `block-dangerous-commands.sh`, `format-on-save.sh`,
  `protect-files.sh`, `scan-secrets.sh`, `warn-large-files.sh`.

### `agents/`

Unchanged from base template.

## Detection coverage

**Databases**: postgres, mysql, mongodb, sqlite, influxdb, redis (via
Prisma, TypeORM, Drizzle, Mongoose, raw pg/mysql2/better-sqlite3,
@influxdata/influxdb-client, ioredis/redis).

**Communication**: http, rabbitmq, kafka, redis-pubsub, grpc, events,
queue, nest-microservices (via @nestjs/microservices, BullMQ, Bull,
kafkajs, amqplib, @golevelup/nestjs-rabbitmq, @grpc/grpc-js,
@nestjs/event-emitter, @nestjs/axios).

**Monorepo**: pnpm-workspace.yaml, turbo.json, nx.json, package.json
workspaces (yarn, bun).

**Observed patterns**: naming (kebab vs camel), DTO location (co-located
vs centralized), controller layout (one-per-feature vs grouped),
injection style (standard vs mixed-with-@Inject).

## Verified against

- Single-app fixture: Prisma + Express + Jest + npm. Clean dry-run, clean
  apply.
- Monorepo fixture: 3-app pnpm workspace + turbo, Mongoose + Influx +
  Redis + RabbitMQ + BullMQ + EventEmitter across apps. Clean dry-run,
  clean apply.

No code errors. Both fixtures ran through unchanged scripts.

## Open questions / next steps

None strictly required. If resuming:

1. Test against a real NestJS repo you own. Most likely integration
   issue: a repo that already has its own `CLAUDE.md` and rules —
   merging into that is the hybrid path discussed (use template as
   skeleton, port hand-written content into unmarkered regions, merge
   rules one-by-one with user's tuning winning on conflicts, keep
   existing `paths:` arrays and let apply.ts append).
2. Consider a `/merge-existing-claude` skill that automates that hybrid
   merge. Not built yet.
3. Consider adding a `--refresh` flag to `setupdotclaude` that skips
   Obsidian prompts when re-running after code changes.

## Known friction points to watch for

- `commands` marker clobbers hand-written commands. Users with custom
  npm scripts should move them outside the marker block.
- Rule duplication if the target repo has differently-named rule files
  that overlap with template's (e.g. `backend.md` vs `api.md`).
- `alwaysApply: true` in `code-quality.md` and `testing.md` can feel
  heavy — users may want to soften to `paths:` scoped.
- apply.ts silently skips files where marker pairs are broken (logged
  as warning). If a user deletes a closing marker, the section won't
  fill.
- Observed patterns returns `mixed` when sampled files don't agree on a
  convention. Users with genuinely mixed codebases should not trust the
  output and should either pick a convention manually or sample a
  narrower subtree.
- Memory-writing policy requires calibration. Too-eager writing
  clutters the vault; too-lazy writing loses context. Triggers in
  CLAUDE.md are the current best guess.
- schemaVersion drift risk if detect.ts evolves faster than apply.ts.
  apply.ts currently accepts 1 or 2 — bump to 3 requires touching both.

## How to resume work

```bash
cd /sessions/practical-ecstatic-ramanujan/mnt/dotclaude-work-in-progress/node_dotclaude
# smoke test
npx tsx scripts/detect.ts --pretty
# dry-run against a test fixture
npx tsx scripts/detect.ts | npx tsx scripts/apply.ts
```

No compile step. No build artifacts. Everything is source.
