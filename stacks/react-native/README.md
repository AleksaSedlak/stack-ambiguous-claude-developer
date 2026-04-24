# ts_dotclaude

A lean, framework-agnostic `.claude/` configuration for everyday **TypeScript / JavaScript**
development — drop into a Next.js, NestJS, Express, or plain Node project and run
`/setupdotclaude` to adapt it to your actual stack.

## Why This Exists

Plugins consume hundreds of tokens per turn and are designed for specific workflows like
scaffolding entire projects. But day-to-day, you're fixing bugs, adding features, reviewing
code, and writing tests — not building products from scratch.

This repo provides a lean, token-efficient `.claude/` configuration optimized for **daily
TS/JS development**. Copy what you need, delete what you don't. `/setupdotclaude` handles
the adaptation.

## Getting Started

### 1. Copy into your project

```bash
git clone <this-repo-url> /tmp/ts_dotclaude

cd your-project
mkdir -p .claude

# Copy config files
cp /tmp/ts_dotclaude/settings.json .claude/
cp -r /tmp/ts_dotclaude/{rules,skills,agents,hooks} .claude/
cp /tmp/ts_dotclaude/.gitignore .claude/
cp /tmp/ts_dotclaude/CLAUDE.md ./
cp /tmp/ts_dotclaude/CLAUDE.local.md.example ./

chmod +x .claude/hooks/*.sh
rm -rf /tmp/ts_dotclaude

# Add CLAUDE.local.md to your project root .gitignore
echo "CLAUDE.local.md" >> .gitignore
```

### 2. Reload Claude Code

If you already have a Claude Code session open, **exit and restart it**. Skills, agents, and
rules are loaded at session start — a running session won't see the new files.

### 3. Run `/setupdotclaude`

```
/setupdotclaude
```

This will:

- Clean up README files that waste tokens
- Scan your codebase — detect package manager, framework, test runner, linter, ORM,
  folder structure
- Customize `CLAUDE.md` with your actual build/test/lint commands
- Update `settings.json` permissions for your package manager
- Adjust rule `paths:` frontmatter to match your real directories
- Auto-detect and enable `prettier` / `eslint --fix` / `biome` for format-on-save
- Remove config that doesn't apply (e.g., `rules/frontend.md` for a headless API)
- Delete framework-specific rules that don't match your project
- Run a final review pass against your full codebase

Every change is confirmed with you before it's applied.

### What it detects

| Signal | What it informs |
|---|---|
| `package.json` + lockfile | Package manager (npm / pnpm / yarn / bun) |
| `next.config.*` | Next.js — enables `rules/frontend.md`, app/pages router patterns |
| `nest-cli.json` / `@nestjs/*` deps | NestJS — module/provider/DI patterns |
| `express` dep + `app.use(...)` | Express — middleware/router patterns |
| `tsconfig.json` | TypeScript project — enables strict-type rules |
| `vitest` / `jest` / `mocha` dep | Test framework — shapes `rules/testing.md` examples |
| `prisma/` / `drizzle.config.*` / `knexfile.*` | ORM/migration tool — enables `rules/database.md` |
| `eslint.config.*` / `biome.json` / `.prettierrc*` | Linter/formatter — wires `format-on-save.sh` |
| MCP servers in `settings.local.json` | Jira / Figma / Postgres / SQS — adapts skill flows |

### Troubleshooting

| Problem | Fix |
|---------|-----|
| Skills or agents not showing up | **Restart Claude Code** — loaded at session start |
| Hooks not running | Run `chmod +x .claude/hooks/*.sh` and verify `jq` is installed |
| "jq not found" blocking everything | Install jq: `brew install jq` (macOS) or `apt install jq` (Linux) |
| format-on-save not formatting | Verify your formatter config exists (`.prettierrc*`, `biome.json`, or `eslint.config.*`) |
| Permission denied on allowed commands | Check glob syntax in `settings.json` — `Bash(pnpm test *)` means the `*` matches arguments after `test` |

### 4. Make it yours

`/setupdotclaude` gets you 90% of the way. To give it your unique touch:

- **`rules/code-quality.md`** — tweak naming conventions, TSDoc requirements, explicit-return-type rules
- **`rules/api.md`** — add your team's REST / tRPC / GraphQL conventions
- **`rules/frontend.md`** — add React component conventions, state management rules
- **`rules/security.md`** — add paths specific to your project's sensitive areas
- **`CLAUDE.md`** — fill in `Key Decisions` with your architectural choices (runtime, ORM,
  validation library, logger, queue, auth strategy)
- **`CLAUDE.local.md`** — rename the `.example` file for personal preferences (gitignored)

## Skills (Slash Commands)

All skills except `/test-writer` are manual-only — you invoke them explicitly.

| Command | Arguments | Description |
|---------|-----------|-------------|
| `/setupdotclaude` | `[focus area]` | Scan your codebase and customize all `.claude/` config files to match your actual stack. Run once after copying. Detects runtime, package manager, framework, test runner, linter, ORM, and module layout — then updates CLAUDE.md, settings.json, rules, hooks, and agents. Confirms every change before applying. |
| `/debug-fix` | `[issue #, error msg, or description]` | Find and fix a bug from any source. Reproduces the issue, traces root cause through code and git history, makes the minimal fix, writes a regression test, wraps up with a branch and commit. |
| `/ship` | `[commit message or PR title]` | Full shipping workflow: scans changes, stages files (skipping `.env`, lockfiles, build output), drafts a commit message matching repo style, pushes, and provides a PR creation URL. Every step requires your confirmation. |
| `/hotfix` | `[issue #, error msg, or description]` | Emergency production fix. Creates a `hotfix/` branch from main, makes the smallest correct change (no refactoring), runs only critical tests, pushes, and provides a PR creation URL with `[HOTFIX]` prefix. |
| `/pr-review` | `["staged", file path, branch name, or omit]` | Reviews local changes by delegating to specialist agents: `@code-reviewer`, `@security-reviewer`, `@performance-reviewer`, `@runtime-reviewer`, `@doc-reviewer`. Synthesizes a unified report with severity-ranked findings. |
| `/tdd` | `[feature description or function signature]` | Strict Red-Green-Refactor TDD loop. Writes one failing test, then minimum code to pass, then refactors. Commits after each green+refactor cycle. |
| `/explain` | `[file, function, or concept]` | Explains code with a one-sentence summary, mental model analogy, ASCII diagram, key non-obvious details, and modification guide. |
| `/refactor` | `[file, function, or pattern]` | Safe refactoring with tests as a safety net. Writes tests first if none exist, plans transformations, makes small testable steps. Never mixes refactoring with behavior changes. |
| `/test-writer` | *(auto-triggers)* | Writes comprehensive tests for new or changed code. Discovers changes via git diff, maps all code paths, writes one test per scenario with Arrange-Act-Assert. **The only skill that can auto-trigger.** |
| `/setup-obsidian` | `[vault path]` | Configure Obsidian vault integration — set vault path, create project folder in vault, symlink memory directory. |
| `/context` | `<search keywords>` | Search your Obsidian vault for relevant notes and bring them into Claude's context. |

## Agents (Subagents)

Agents run in isolated context and are auto-delegated by `/pr-review`, or invoked directly
with `@agent-name`.

| Agent | When It's Used | What It Does |
|-------|---------------|--------------|
| `@code-reviewer` | Auto-delegated by `/pr-review`, or invoke directly | Reviews code for correctness and maintainability. Catches missing null checks after optional chaining, swallowed promise rejections, non-exhaustive switch/discriminated unions, missing explicit return types on exports, N+1 queries, and `any` creeping into typed code. |
| `@security-reviewer` | Auto-delegated when security-related code is changed | Security-focused static analysis. Covers SQL injection via string concatenation, `eval`/`Function`/dynamic require, prototype pollution, mass-assignment into ORM models, command injection via `child_process`, SSRF, insecure JWT usage, `dangerouslySetInnerHTML` with user input, CORS misconfig, and unaudited deps. |
| `@performance-reviewer` | Auto-delegated when perf-sensitive code is changed | Finds real bottlenecks in DB calls, async pipelines, and frontend render paths. Checks for N+1, missing `SELECT` projection, unbounded queries, sequential awaits that should be parallel, blocking the event loop, large payloads in LocalStorage/memory, and unthrottled effects. |
| `@runtime-reviewer` | Auto-delegated when async/Node runtime code is changed | Reviews async/await, Promises, event loop health, streams, and memory. Catches unhandled rejections, floating promises, blocking sync I/O in request handlers, missing `AbortSignal` propagation, memory leaks from listeners never removed, and backpressure issues in streams. |
| `@doc-reviewer` | Auto-delegated when documentation changes | Reviews docs for accuracy by cross-referencing source code. Verifies JSDoc/TSDoc against actual signatures, code examples, config options, and file paths. Identifies stale references and missing prerequisites. |

### Using Agents Directly

```
@security-reviewer Review the auth middleware in src/middleware/auth.ts
```

```
@runtime-reviewer Review my new worker in src/jobs/email-sender.ts
```

```
@code-reviewer Check my staged changes before I commit
```

## What's Inside

```
ts_dotclaude/
├── CLAUDE.md                           # Template project instructions → copy to YOUR project root
├── CLAUDE.local.md.example             # Personal overrides template → copy and rename to CLAUDE.local.md
├── settings.json                       # Project settings → copy to .claude/
├── settings.local.json.example         # Personal settings + MCP servers template
├── .gitignore                          # Gitignore for .claude/ directory
├── rules/                              # Modular instructions → copy to .claude/rules/
│   ├── code-quality.md                 #   TS/JS naming, TSDoc, explicit types, module structure (always loaded)
│   ├── testing.md                      #   Framework-agnostic test principles + Vitest/Jest examples (always loaded)
│   ├── database.md                     #   ORM migration safety (Prisma/Drizzle/Knex/TypeORM) — path-scoped
│   ├── error-handling.md               #   Result types, Error classes, async/await error flow — path-scoped
│   ├── security.md                     #   Input validation, injection, secrets, headers — path-scoped
│   ├── api.md                          #   REST/tRPC/GraphQL handler patterns — path-scoped
│   └── frontend.md                     #   React/Next patterns, hooks, state, a11y — path-scoped
├── skills/                             # Slash commands → copy to .claude/skills/
│   ├── setupdotclaude/SKILL.md         #   /setupdotclaude — scan codebase, customize all config files
│   ├── setup-obsidian/SKILL.md         #   /setup-obsidian — configure Obsidian vault integration
│   ├── context/SKILL.md                #   /context — search Obsidian vault for relevant notes
│   ├── debug-fix/SKILL.md              #   /debug-fix — find and fix bugs from any source
│   ├── ship/SKILL.md                   #   /ship — commit, push, PR with confirmations
│   ├── hotfix/SKILL.md                 #   /hotfix — emergency production fix, minimal change, ship fast
│   ├── pr-review/SKILL.md              #   /pr-review — review PR or staged changes via specialist agents
│   ├── tdd/SKILL.md                    #   /tdd — strict red-green-refactor TDD loop
│   ├── explain/SKILL.md                #   /explain <file-or-function>
│   ├── refactor/SKILL.md               #   /refactor <target>
│   └── test-writer/SKILL.md            #   Auto-triggers on new features — comprehensive tests
├── agents/                             # Specialized subagents → copy to .claude/agents/
│   ├── code-reviewer.md                #   General TS/JS code review
│   ├── security-reviewer.md            #   Injection, secrets, auth, mass assignment, deps
│   ├── performance-reviewer.md         #   DB/queries, async pipelines, render paths
│   ├── runtime-reviewer.md             #   Promises, event loop, streams, leaks
│   └── doc-reviewer.md                 #   TSDoc/JSDoc accuracy and completeness
└── hooks/                              # Hook scripts → copy to .claude/hooks/
    ├── protect-files.sh                #   Block edits to .env, keys, lockfiles, .claude/hooks/
    ├── warn-large-files.sh             #   Block writes to node_modules, dist, .next, coverage, binaries
    ├── scan-secrets.sh                 #   Detect API keys, tokens, connection strings in content
    ├── block-dangerous-commands.sh     #   Block push to main, force push, reset --hard, npm publish, rm -rf, DROP TABLE
    ├── format-on-save.sh               #   Auto-format after edits (prettier / biome / eslint --fix)
    └── session-start.sh                #   Inject branch/commit/stash context at session start
```

## Obsidian Integration

ts_dotclaude can use your Obsidian vault as a shared knowledge base between you and Claude.
Claude's memory directory is symlinked to `Claude/<project>/memory/` in your vault, and the
`/context` skill searches your vault for relevant notes.

Run `/setup-obsidian` after initial setup (or let `/setupdotclaude` prompt you).

## What NOT to Put in .claude/

- **Plugins for daily work** — they eat 200-500+ tokens/turn and are scoped to specific workflows
- **Anything Claude can read from code** — don't describe your file structure; Claude can explore it
- **Standard conventions** — Claude already knows Prettier defaults, npm scripts, Node conventions
- **Verbose explanations** — every line in CLAUDE.md costs tokens; if removing it doesn't cause mistakes, cut it
- **Frequently changing info** — volatile details belong in code comments or `CLAUDE.local.md`

**Token cost rule of thumb**: Rules with `alwaysApply: true` cost tokens every turn.
Path-scoped rules only cost tokens when working near matched files. Skills and agents cost
tokens only when invoked.

## Credits

- Modeled on the Elixir/Phoenix dotclaude config (`ex_dotclaude`) maintained by SpotHopperServices
- Draws on [Official Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
