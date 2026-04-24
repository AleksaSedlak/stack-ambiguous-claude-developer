---
name: setupdotclaude
description: Scan the project codebase and customize all .claude/ configuration files to match. Run this after adding the .claude/ folder to a new TypeScript/JavaScript project.
argument-hint: "[optional: focus area like 'frontend' or 'backend']"
disable-model-invocation: true
---

Scan this project's codebase and customize every `.claude/` configuration file to match the
actual stack, conventions, and patterns in use. Confirm with the user before each change
using AskUserQuestion.

CLAUDE.md must be at the project root (`./CLAUDE.md`), NOT inside `.claude/`. All other
config files live inside `.claude/`.

If the project is empty or has no source code yet, tell the user the defaults will be kept
as-is and stop.

## Phase 0: Clean Up Non-Config Files

Before anything else, delete files inside `.claude/` that exist for the ts_dotclaude repo
itself but waste tokens or cause issues at runtime:

- `.claude/README.md` (repo README accidentally copied in)
- `.claude/CONTRIBUTING.md` (repo contributing guide accidentally copied in)
- `.claude/.gitignore` (for the dotclaude repo, not the project — the project has its own)
- `.claude/rules/README.md`
- `.claude/agents/README.md`
- `.claude/hooks/README.md`
- `.claude/skills/README.md`

Also delete `.claude/CLAUDE.md` if it exists — CLAUDE.md belongs at the project root, not
inside `.claude/`.

## Phase 1: Detect Tech Stack

### 1.1 — Package manager & runtime

Scan for lockfiles and manifests (in this priority order — the first match wins):

| File | Package manager |
|---|---|
| `pnpm-lock.yaml` | pnpm |
| `bun.lockb` | bun |
| `yarn.lock` | yarn |
| `package-lock.json` | npm |

Read `package.json`:
- `name`, `version`, `type: "module"` vs CommonJS
- `engines.node` — target Node version
- `packageManager` field (pnpm/yarn/npm with pinned version)
- `scripts` — capture `build`, `dev`, `start`, `test`, `lint`, `format`, `typecheck`, `migrate`
- `dependencies` and `devDependencies`

Also check for `.nvmrc`, `.node-version`, `tsconfig.json`, `jsconfig.json`.

### 1.2 — Framework

Detect by deps and config files:

| Signal | Framework |
|---|---|
| `next` dep + `next.config.*` | Next.js (check `app/` vs `pages/` for router) |
| `@nestjs/core` dep + `nest-cli.json` | NestJS |
| `express` dep + `app.use(...)` patterns | Express |
| `fastify` dep | Fastify |
| `hono` dep | Hono |
| `@sveltejs/kit` + `svelte.config.*` | SvelteKit |
| `nuxt` + `nuxt.config.*` | Nuxt |
| `astro` + `astro.config.*` | Astro |
| `remix` / `@remix-run/*` | Remix |
| `vite` dep (no framework) | Vite SPA |
| None of the above | Plain Node / library |

### 1.3 — Language & type checker

- `tsconfig.json` present → TypeScript project. Read `compilerOptions` for `strict`,
  `noUncheckedIndexedAccess`, `target`, `moduleResolution`.
- No `tsconfig.json`, only `.js`/`.mjs`/`.cjs` → JavaScript project.
- `@types/*` in devDeps but no `tsconfig.json` → JSDoc-typed JS.

### 1.4 — Test framework

Detect by devDeps and config:

| Signal | Test framework |
|---|---|
| `vitest` + `vitest.config.*` | Vitest |
| `jest` + `jest.config.*` or `"jest"` key in package.json | Jest |
| `@playwright/test` | Playwright (e2e) |
| `cypress` | Cypress (e2e) |
| `mocha` + `.mocharc*` | Mocha |
| No test framework, uses `node --test` | Node built-in test runner |

Also check `test/`, `tests/`, `__tests__/`, `**/*.test.ts`, `**/*.spec.ts` for existing
test locations — match the project's convention.

### 1.5 — Linter & formatter

| Signal | Tool |
|---|---|
| `biome.json` / `biome.jsonc` | Biome (format + lint) |
| `.prettierrc*` / `prettier.config.*` / `"prettier"` key | Prettier |
| `eslint.config.*` (flat) or `.eslintrc*` | ESLint |

Projects commonly have Prettier + ESLint, or just Biome.

### 1.6 — ORM / database

| Signal | Tool |
|---|---|
| `prisma/schema.prisma` + `@prisma/client` | Prisma |
| `drizzle.config.*` + `drizzle-orm` | Drizzle |
| `knexfile.*` + `knex` | Knex |
| `ormconfig.*` + `typeorm` | TypeORM |
| `sequelize` dep | Sequelize |
| `mongoose` dep | Mongoose (MongoDB) |
| `pg` / `mysql2` / `better-sqlite3` direct | Raw driver |
| None | No database |

Locate the migrations directory (e.g. `prisma/migrations/`, `drizzle/`, `migrations/`,
`db/migrations/`, `src/db/migrations/`) — this determines the `paths:` for `rules/database.md`.

### 1.7 — Project structure

Grep / Glob the most common source roots in order: `src/`, `app/`, `server/`, `api/`,
`lib/`, `packages/*/src/`. Identify:

- Source root
- Controllers / route handlers — likely in `controllers/`, `routes/`, `app/api/`,
  `pages/api/`, or NestJS `*.controller.ts`
- Services / business logic — `services/`, `modules/`
- Auth — `auth/`, `middleware/auth*`, `guards/`
- Frontend — `components/`, `app/**/page.tsx`, `pages/**` (Next), `src/routes/**` (SvelteKit)
- Tests — see 1.4

Check `git log --oneline -20` for commit message style (conventional commits? scope tags?
imperative?).

## Phase 1.5: Detect Available Integrations

### MCP Servers

Read `mcpServers` from settings files (check all in order, merge results):

1. `.claude/settings.local.json` (project-level, gitignored)
2. `.claude/settings.json` (project-level, committed)
3. `~/.claude/settings.local.json` (user-level, gitignored)
4. `~/.claude/settings.json` (user-level)

Identify types by server name / command:
- `jira` / `atlassian` → Jira
- `figma` → Figma
- `postgres` / `pg` → Postgres
- `sqs` / `aws-sqs` → AWS SQS
- `sentry` → Sentry
- `linear` → Linear

### CLI Tools

Check: `which jq` (needed by hook scripts), `which gh` (optional, not required — skills
always fall back to URL construction).

## Phase 2: Present Findings

Present a summary using AskUserQuestion:

```
I scanned your project. Here's what I found:

**Runtime**: Node [version] / **Package manager**: [pnpm/npm/yarn/bun]
**Language**: [TypeScript/JavaScript] ([strict? yes/no])
**Framework**: [Next.js App Router / NestJS / Express / Fastify / plain Node / ...]
**Test**: [Vitest / Jest / node --test / none]
**Lint/Format**: [Biome / Prettier + ESLint / ESLint only / none]
**ORM**: [Prisma / Drizzle / Knex / TypeORM / none]
**Source root**: [src/ / app/ / server/ / ...]

**Integrations**:
MCP servers: [list, or "none detected"]
CLI tools: jq [installed / not installed]

Should I customize the .claude/ files based on this? (yes / no / corrections)
```

Incorporate corrections if any.

## Phase 3: Customize Each File

For each file below, propose specific changes and ask the user to confirm before applying.

### 3.1 — CLAUDE.md

Strip any remaining `> REPLACE:` placeholder blocks. Fill in:

- **Commands** block — actual scripts from `package.json`:
  - Install: `<pm> install`
  - Build: `<pm> run build` (only if the script exists)
  - Typecheck: whatever runs `tsc --noEmit`
  - Test: `<pm> test` + single-file invocation for the detected runner
  - Lint / Format: actual lint & format commands
  - Dev: `<pm> run dev`
  - Migrate: if ORM detected, add the migrate command
- **Architecture** — replace placeholder structure with the detected source root and the
  conventions actually used in the project. Keep it short — only non-obvious parts.
- **Key Decisions** — leave the section header, pre-fill any decisions inferred from
  the stack (e.g. "Prisma with `@prisma/client` — queries via service classes in
  `src/modules/*/`"). Ask the user to confirm or edit.

Remove sections that don't apply (e.g. the TypeScript rules block if it's a plain JS project).

### 3.2 — settings.json

- Trim `permissions.allow` to only include the detected package manager's rules. Remove
  others to keep the allowlist tight.
- Add project-specific allow rules for commands in `package.json` scripts if they use
  unusual binaries (`prisma`, `drizzle-kit`, `tsx`, `turbo`, `nx`, etc.).
- Keep `deny` rules for secrets as-is — they're universal.

### 3.3 — rules/code-quality.md

- If the project is JavaScript (no tsconfig), delete the **TypeScript** block.
- Sample 5-10 source files to detect actual naming style (kebab-case vs camelCase
  filenames). If it differs from the default, update.
- If the project already uses a strict TSDoc style or a lax one, reflect that.

### 3.4 — rules/testing.md

- Replace the example blocks with snippets that match the detected test framework.
- If the project has no tests at all, shorten the file significantly — keep only
  principles and naming.

### 3.5 — rules/security.md

Update the `paths:` frontmatter to match actual project directories for auth /
middleware / controllers. Keep patterns that match, remove those that don't.

### 3.6 — rules/error-handling.md

Update `paths:` to match the actual source root. If the project is frontend-only (no
backend), narrow the scope.

### 3.7 — rules/api.md

- If the project has no HTTP layer (pure library, CLI, worker), delete this file.
- Otherwise update `paths:` to match where handlers actually live.

### 3.8 — rules/frontend.md

- If the project has no UI (headless API, worker, CLI), delete this file.
- Otherwise update `paths:` to match actual component directories. If using Vue/Svelte/
  Solid instead of React, rewrite the examples to match or delete the React-specific
  sections.

### 3.9 — rules/database.md

- If no ORM / migrations detected, delete this file.
- If detected, update `paths:` to the actual migrations directory.

### 3.10 — hooks/format-on-save.sh

- Confirm the formatter config exists. If neither Prettier nor Biome nor ESLint config is
  present, warn the user that format-on-save won't activate.
- No file changes needed unless the project uses a non-standard formatter.

### 3.11 — hooks/block-dangerous-commands.sh

- Determine the default branch (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null`).
  If it's not `main` or `master`, update the regex.
- Remove ORM-specific deny rules that don't apply (e.g. Drizzle rules if the project
  uses Prisma, and vice versa).

### 3.12 — skills/

Most skills are methodology-based and project-agnostic. Leave unchanged.

Exceptions — customize based on Phase 1.5 integrations:

- **`/debug-fix`** Step 1: if Jira MCP detected, set the first bullet to "Jira ticket
  (e.g., PROJ-123) → fetch from the Jira MCP server". Otherwise: "ask the user to paste
  the ticket description".
- **`/hotfix`** Step 2: same Jira logic as `/debug-fix`.

All skills use local git commands. No `gh` CLI required.

### 3.13 — agents/

- **runtime-reviewer.md**: keep if Node code runs async work, streams, workers, or
  long-lived processes. Delete for pure static-site-generation projects.
- **performance-reviewer.md**: keep (universal)
- **code-reviewer.md**: keep (universal)
- **security-reviewer.md**: keep (security applies everywhere)
- **doc-reviewer.md**: delete if the project has no documentation directory and very
  little inline doc

## Phase 3.5: Generate workflow-commands.json

Generate `.claude/workflow-commands.json` from detected tools. This file is consumed
by the `autonomous-commit.md` rule for pre-commit verification checks.

Detect commands from `pyproject.toml` tool sections and installed packages:

| Key | Detection | Fallback |
|-----|-----------|----------|
| `typecheck` | `mypy` installed or in `[tool.mypy]` → `mypy .`; or `pyright` → `pyright` | `null` |
| `lint` | `ruff` installed or in `[tool.ruff]` → `ruff check .`; or `flake8` → `flake8 .` | `null` |
| `test` | `pytest` installed or in `[tool.pytest]` → `pytest`; or `unittest` → `python -m unittest` | `null` |
| `build` | `[build-system]` in pyproject.toml → `python -m build` | `null` |
| `format` | `ruff` → `ruff format .`; or `black` → `black .` | `null` |

Write the file. Use `null` for commands that don't apply. Example:

```json
{
  "typecheck": "mypy .",
  "lint": "ruff check .",
  "test": "pytest",
  "build": null,
  "format": "ruff format ."
}
```

## Phase 3.6: Obsidian Integration (Optional)

Ask:

> Do you use Obsidian as a knowledge base for technical notes? (yes / no)

If yes — invoke `/setup-obsidian` to delegate the full setup.
If no — skip.

## Phase 4: Review & Simplify

After all changes are applied, run a final review pass.

- Strip any remaining `> REPLACE:` placeholder blocks from `CLAUDE.md`.
- Do the rules match how the code is actually written?
- Do the settings permissions cover the commands the project actually uses?
- Do the security rule paths match where sensitive code actually lives?
- Do the hook protections cover the files that actually need protecting?
- Are there project patterns, conventions, or architectural decisions not yet captured?
- Remove any redundancy introduced during customization.
- Ensure no file contradicts another.
- Trim verbose instructions back to essentials.
- Verify all YAML frontmatter is valid.
- Verify all hook scripts referenced in settings.json exist and are executable
  (`ls -la .claude/hooks/*.sh` — all six should have `x` bits).

Present findings. Confirm before applying fixes.

## Phase 5: Summary

```
Setup complete. Here's what was customized:

- CLAUDE.md: updated commands for [pm] + [framework]
- settings.json: permissions trimmed to [pm] only
- rules/security.md: paths updated to [actual dirs]
- rules/frontend.md: [kept/removed]
- rules/database.md: [kept with <orm>/removed — no ORM detected]
- rules/api.md: [kept/removed]
- hooks/format-on-save.sh: [<formatter> detected / no formatter — format-on-save inactive]
- hooks/block-dangerous-commands.sh: default branch set to [<branch>]
- [any other changes]

Files left as defaults (universal, no project-specific changes needed):
- [list]

Review pass: [issues found and fixed / "all clean"]
```

## Rules

- NEVER write changes without user confirmation first
- NEVER delete a file without confirming — propose "remove" and explain why
- If the project is empty (no source, no `pyproject.toml`), offer best-practice defaults:
  present recommended tools (uv, pytest, ruff, mypy), ask "Apply these defaults?
  (yes / no / customize)", then fill CLAUDE.md markers, set rule paths to standard
  locations, generate workflow-commands.json with defaults, and configure hooks
  for ruff format
- If detection is uncertain, ASK the user rather than guessing
- Preserve manual edits the user has already made to `.claude/` files — only update
  sections that need project-specific customization
- Keep it minimal — don't add complexity. If the default works, leave it alone.
