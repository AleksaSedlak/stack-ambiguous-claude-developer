---
name: setupdotclaude
description: Scan the project codebase and customize all .claude/ configuration files to match. Run this after adding the .claude/ folder to a new project.
argument-hint: "[optional: focus area like 'frontend' or 'backend']"
disable-model-invocation: true
---

Scan this project's codebase and customize every `.claude/` configuration file to match the actual tech stack, conventions, and patterns in use. Confirm with the user before each change using AskUserQuestion.

CLAUDE.md must be at the project root (`./CLAUDE.md`), NOT inside `.claude/`. All other config files live inside `.claude/`.

If the project is empty or has no source code yet, tell the user the defaults will be kept as-is and stop.

## Phase 0: Clean Up Non-Config Files

Before anything else, delete files inside `.claude/` that exist for the dotclaude repo itself but waste tokens or cause issues at runtime:
- `.claude/README.md` (repo README accidentally copied in)
- `.claude/CONTRIBUTING.md` (repo contributing guide accidentally copied in)
- `.claude/.gitignore` (for the dotclaude repo, not the project — the project has its own .gitignore)
- `.claude/rules/README.md`
- `.claude/agents/README.md`
- `.claude/hooks/README.md`
- `.claude/skills/README.md`

Also delete `.claude/CLAUDE.md` if it exists — CLAUDE.md belongs at the project root, not inside `.claude/`.

## Phase 1: Detect Tech Stack

Scan for `mix.exs` and config files to detect: Elixir version, Phoenix version, key dependencies, test setup, and project structure.

Check `mix.exs` for:
- Elixir and OTP version requirements
- Phoenix version
- Key deps: `phoenix_live_view`, `ecto_sql`, `oban`, `broadway`, `req`, `swoosh`, `assent`, `bandit`
- Test deps: `mox`, `ex_machina`, `bypass`

Check for:
- `config/runtime.exs` — confirms modern Phoenix (1.6+)
- `.formatter.exs` — confirms mix format is configured
- `priv/repo/migrations/` — confirms Ecto/database usage
- `lib/<app>_web/` — confirms Phoenix web layer
- `lib/<app>_web/live/` — confirms LiveView usage
- `assets/` — confirms frontend asset pipeline
- `Makefile` or `.github/` — CI/CD setup

Detect folder structure: contexts in `lib/<app>/`, web layer in `lib/<app>_web/`.

Check `git log --oneline -20` for commit message style.

## Phase 1.5: Detect Available Integrations

Scan for MCP servers and CLI tools available in the environment.

### MCP Servers

Read `mcpServers` from settings files (check all in order, merge results):
1. `.claude/settings.local.json` (project-level, gitignored)
2. `.claude/settings.json` (project-level, committed)
3. `~/.claude/settings.local.json` (user-level, gitignored)
4. `~/.claude/settings.json` (user-level)

For each server found, identify its type by matching the server name or command against known patterns:
- `jira` or `atlassian` → Jira issue tracker
- `figma` → Figma design tool
- `postgres` or `pg` → PostgreSQL database
- `sqs` or `aws-sqs` → AWS SQS queue

Record which types are available for use in Phase 3.

### CLI Tools

Check: `which jq` — needed by hook scripts.

### Present in Phase 2

Add integration status to the Phase 2 summary output:

```
**Integrations**:
MCP servers: [list found types, or "none detected"]
CLI tools: jq [installed / not installed]
```

### Apply in Phase 3

When customizing skills in Phase 3, use the detected integrations:
- If Jira MCP detected → `/debug-fix` and `/hotfix` Step 2 should use "fetch from Jira MCP server" for ticket IDs
- If no Jira MCP → `/debug-fix` and `/hotfix` Step 2 should use "ask user to paste the ticket description" for ticket IDs
- `gh` CLI is never used — all GitHub operations use local git commands

## Phase 2: Present Findings

Present a summary to the user using AskUserQuestion:

```
I scanned your project. Here's what I found:

**Elixir**: [version] / **Phoenix**: [version]
**LiveView**: [yes/no] / **Ecto**: [yes/no] / **Oban**: [yes/no]
**Auth**: [assent/custom/none]
**HTTP client**: [req/httpoison/none]
**Test deps**: [mox/ex_machina/none]
**Source**: lib/<app>/ + lib/<app>_web/
**Contexts detected**: [list]

Should I customize the .claude/ files based on this? (yes/no/corrections)
```

If the user provides corrections, incorporate them.

## Phase 3: Customize Each File

For each file below, propose the specific changes and ask the user to confirm before applying.

### 3.1 — CLAUDE.md

Replace the template commands with actual commands from the detected manifest:
- **Build**: actual build command from package.json scripts, Makefile targets, etc.
- **Test**: actual test command + how to run a single test file
- **Lint/Format**: actual lint and format commands
- **Dev**: actual dev server command
- **Architecture**: replace placeholder directories with actual project structure (only non-obvious parts)

Remove sections that don't apply (e.g., Architecture section for a single-file utility).

### 3.2 — settings.json

Update permissions to match actual commands:
- Confirm all `mix` allow rules cover the commands used in this project
- Add project-specific allow rules if the project has a Makefile with common targets
- Keep deny rules for secrets as-is (these are universal)

### 3.3 — rules/code-quality.md

Update naming conventions ONLY if the project's existing code uses different patterns:
- Sample 5-10 source files to detect actual naming style (camelCase vs snake_case, etc.)
- If the project uses different file naming than the template, update
- If the project's import style differs, update the import order section

If everything matches the defaults, leave it unchanged.

### 3.4 — rules/testing.md

Update if the detected test framework has specific idioms. Otherwise leave as-is (it's only 3 lines).

### 3.5 — rules/security.md

Update the `paths:` frontmatter to match actual project directories:
- Replace `src/api/**` with actual API directory paths found
- Replace `src/auth/**` with actual auth directory paths
- Replace `src/middleware/**` with actual middleware paths
- If none found, keep the defaults as reasonable guesses

### 3.5b — rules/error-handling.md

Update the `paths:` frontmatter to match actual backend directories (same paths as security.md plus service/handler directories). If the project has no backend, delete this file.

### 3.6 — rules/liveview.md

- **If no LiveView detected** (`lib/<app>_web/live/` does not exist): delete this file
- **If LiveView exists**: keep as-is — update path patterns in frontmatter if the project uses non-standard directories

### 3.7 — hooks/format-on-save.sh

- Confirm `.formatter.exs` exists in the project root — if missing, warn the user that `mix format` auto-formatting will not activate
- No changes needed if `.formatter.exs` is present

### 3.8 — hooks/block-dangerous-commands.sh

Check the default branch name (`git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null` or `git remote show origin`). If it's not `main` or `master`, update the regex pattern.

### 3.9 — rules/database.md

- Check if `priv/repo/migrations/` exists and `ecto_sql` is in `mix.exs` deps
- **If Ecto detected**: keep as-is — paths already set to `priv/repo/migrations/**`
- **If no database detected**: delete `rules/database.md` entirely

### 3.10 — skills/

Most skills are methodology-based and project-agnostic. Leave unchanged.

Exceptions — customize these based on Phase 1.5 integration detection:
- **`/debug-fix`** Step 1: if Jira MCP detected, ensure the first bullet reads "Jira ticket (e.g., PROJ-123) → fetch from the Jira MCP server". If no Jira MCP, ensure it reads "ask the user to paste the ticket description".
- **`/hotfix`** Step 2: same Jira logic as `/debug-fix`.

All skills already use local git commands (no `gh` CLI). No changes needed for git operations.

### 3.11 — agents/

- **otp-reviewer.md**: keep if project has GenServer/Supervisor/Broadway modules — delete if it's a simple Phoenix CRUD app with no custom OTP
- **code-reviewer.md**: keep (universal)
- **security-reviewer.md**: keep (security applies everywhere)
- **performance-reviewer.md**: keep (universal)
- **doc-reviewer.md**: delete if the project has no documentation directory
- **frontend-designer.md**: delete (not relevant for Phoenix/LiveView projects)

## Phase 3.5: Generate workflow-commands.json

Generate `.claude/workflow-commands.json` from detected tools. This file is consumed
by the `autonomous-commit.md` rule for pre-commit verification checks.

Detect commands from `mix.exs` and installed tools:

| Key | Detection | Fallback |
|-----|-----------|----------|
| `typecheck` | `dialyxir` in deps → `mix dialyzer` | `null` |
| `lint` | `credo` in deps → `mix credo`; always: `mix compile --warnings-as-errors` | `mix compile --warnings-as-errors` |
| `test` | Always available → `mix test` | `mix test` |
| `build` | Always available → `mix compile` | `null` |
| `format` | Always available → `mix format` | `mix format` |

Write the file. Use `null` for commands that don't apply. Example:

```json
{
  "typecheck": "mix dialyzer",
  "lint": "mix credo && mix compile --warnings-as-errors",
  "test": "mix test",
  "build": null,
  "format": "mix format"
}
```

## Phase 3.6: Obsidian Integration (Optional)

Ask the user:
> Do you use Obsidian as a knowledge base for technical notes? (yes/no)

If no — skip this phase entirely.

If yes — invoke the `/setup-obsidian` skill to handle the full setup. This delegates to the standalone skill so the logic is in one place.

After `/setup-obsidian` completes, continue to Phase 4.

## Phase 4: Review & Simplify

After all changes are applied, run a thorough final review pass.

Strip any remaining `> REPLACE:` placeholder blocks from `CLAUDE.md` — these are template guidance that should have been replaced with real content or removed during Phase 3.1.

Review the entire codebase alongside the customized `.claude/` configuration:
- Do the rules match how the code is actually written?
- Do the settings permissions cover the commands the project actually uses?
- Do the security rule paths match where sensitive code actually lives?
- Do the hook protections cover the files that actually need protecting in this project?
- Are there project patterns, conventions, or architectural decisions not yet captured in the config?
- Remove any redundancy introduced during customization
- Ensure no file contradicts another
- Trim any verbose instructions back to essentials
- Verify all YAML frontmatter is valid
- Verify all hook scripts referenced in settings.json exist and are executable

Present the review findings to the user. If changes are needed, confirm before applying.

## Phase 5: Summary

After everything is finalized, present a summary:

```
Setup complete. Here's what was customized:

- CLAUDE.md: updated commands for [stack]
- settings.json: permissions updated for [package manager]
- rules/security.md: paths updated to [actual dirs]
- rules/liveview.md: [kept/removed]
- hooks/format-on-save.sh: [.formatter.exs present/missing]
- [any other changes]

Files left as defaults (universal, no project-specific changes needed):
- [list]

Review pass: [any issues found and fixed, or "all clean"]
```

## Rules

- NEVER write changes without user confirmation first
- NEVER delete a file without confirming — propose "remove" and explain why
- If the project is empty (no source files, no `mix.exs`), offer best-practice defaults:
  present recommended tools (mix test, mix format, credo), ask "Apply these
  defaults? (yes / no / customize)", then fill CLAUDE.md markers, set rule
  paths to standard locations, generate workflow-commands.json with defaults,
  and configure hooks for mix format
- If detection is uncertain, ASK the user rather than guessing
- Preserve any manual edits the user has already made to .claude/ files — only update sections that need project-specific customization
- Keep it minimal — don't add complexity. If the default works, leave it alone.
