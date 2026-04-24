---
name: setupdotclaude
description: Personalize the .claude/ template to a NestJS project by running the detect.ts scanner and applying its plan. Run once after dropping .claude/ into a new repo.
argument-hint: "[optional: --yes to skip confirmation prompts]"
disable-model-invocation: true
---

Personalize the `.claude/` template to this NestJS project. You do NOT detect the
stack by hand — you run `scripts/detect.ts` and let it produce a JSON summary,
then you run `scripts/apply.ts` to mutate files. Your job is to **orchestrate**,
ask the user for approval at each boundary, and show them what the scripts
would or did change.

The template is NestJS-only for now. If detection says this is not a NestJS
project, warn the user clearly and ask whether to continue anyway.

## The pipeline at a glance

```
detect.ts  ──JSON──▶  you summarize  ──▶  apply.ts --dry-run  ──▶  user confirms  ──▶  apply.ts --apply
```

Three decision points where you stop and ask the user:
1. After detection — "does this summary match your project?"
2. After dry-run — "apply these changes?"
3. (Optional) After apply — "do you want to set up Obsidian integration?"

## Step 0 — Sanity checks

Before anything else:

- Confirm `.claude/scripts/detect.ts` and `.claude/scripts/apply.ts` both exist.
  If they don't, this template is corrupt — tell the user to re-install and stop.
- Confirm `package.json` exists at the project root. If not, say "no
  `package.json` — this doesn't look like a Node project. Keeping defaults."
  and stop.
- Confirm `npx` is available (it's bundled with npm, so this is almost always yes).

Delete these stray files if they exist (they're artifacts from the dotclaude
repo itself, not meant for the consuming project):

- `.claude/README.md`
- `.claude/CONTRIBUTING.md`
- `.claude/.gitignore`
- `.claude/rules/README.md`
- `.claude/agents/README.md`
- `.claude/hooks/README.md`
- `.claude/skills/README.md`
- `.claude/CLAUDE.md` (CLAUDE.md lives at the project root, not inside `.claude/`)

## Step 1 — Run the detector

Run:

```bash
npx tsx .claude/scripts/detect.ts --pretty
```

Capture the stdout (JSON) and parse it. Do **not** re-run detection by reading
`package.json` yourself — the detector is the source of truth and you need its
exact output to pipe into `apply.ts` later.

If the command fails (non-zero exit), show the stderr to the user and stop.
Common cause: no `package.json`, which means the detector wrote an `errors`
array to stdout and exited 1.

## Step 2 — Summarize for the user

Present the detection result using **AskUserQuestion**. Format it compactly —
don't dump raw JSON at the user. Something like:

```
Detected:
  • NestJS: <isNestJS ? version : "NOT DETECTED">
  • Node: <nodeVersion ?? "not pinned">
  • Package manager: <packageManager>
  • HTTP adapter: <httpAdapter>
  • ORM: <orm> <ormDirs.length ? "("+ormDirs.join(",")+")" : "">
  • Tests: <testFramework>
  • Lint/format: <linter> / <formatter>
  • Monorepo: <monorepo.tool ?? "no">
  • Source root: <srcLayout.srcDir ?? "(no src/)">

Warnings: <warnings.length or "none">
```

Then ask, via AskUserQuestion:

> Does this match your project?

Options:
- **Yes, continue** — proceed to Step 3
- **No, stop** — abort, print no changes were made
- **Show me the full JSON** — print the raw detection, then re-ask

If the user says "no", stop. Do not guess at corrections — the detector is
deterministic and the user editing JSON by hand is error-prone. Better to fix
the underlying signal (lockfile, package.json deps, etc.) and re-run.

## Step 3 — Dry-run

Write the detection JSON to a temp file so you can pipe it twice:

```bash
npx tsx .claude/scripts/detect.ts > /tmp/claude-detection.json
npx tsx .claude/scripts/apply.ts --input /tmp/claude-detection.json
```

The default mode is `--dry-run`. `apply.ts` will print a plan like:

```
# apply.ts — DRY RUN (no files changed)
  [fill]    CLAUDE.md :: header   (56 -> 124 chars)
  [fill]    CLAUDE.md :: commands (40 -> 310 chars)
  [paths]   rules/api.md
              + packages/api/**/*.controller.ts
  [delete]  .claude/rules/database.md
Summary: 2 fills, 1 path rewrites, 1 deletes, 0 skips, 0 warnings, 0 errors.
```

Show this plan verbatim to the user.

## Step 4 — Confirm and apply

Ask, via AskUserQuestion:

> Apply these changes?

Options:
- **Apply** — run `apply.ts --apply`
- **Cancel** — leave everything untouched
- **Show me the full CLAUDE.md diff first** — read the current CLAUDE.md and
  show the replacement content that would be filled in, then re-ask

On "Apply", run:

```bash
npx tsx .claude/scripts/apply.ts --input /tmp/claude-detection.json --apply
```

Print the `# apply.ts — APPLIED` output to the user.

## Step 5 — Manual follow-ups

The detector + applier handle stack detection, CLAUDE.md markers, rule
`paths:` frontmatter, and safe deletions. Some things still need a human:

- **Key Decisions section** in CLAUDE.md — ask the user one question: "Any
  non-obvious decisions about this project I should record?" Write their
  answer into the `## Key Decisions` section. Skip if they have nothing.
- **`.env.example` coverage** — if the project has an `.env` file but no
  `.env.example`, mention it. Don't auto-generate one.
- **Default branch** in `hooks/block-dangerous-commands.sh` — if it's not
  `main` or `master`, ask the user what their default branch is and update
  the regex in the hook accordingly.

Keep this step short. Do not re-scan — the heuristic scripts already did.

## Step 5.5 — Generate workflow-commands.json

Generate `.claude/workflow-commands.json` from the detection JSON (already
available from Step 1). This file is consumed by the `autonomous-commit.md`
rule for pre-commit verification checks.

Map detected tools to commands:

| Key | Detection | Fallback |
|-----|-----------|----------|
| `typecheck` | `scripts.typecheck` or tsc in devDeps → `npx tsc --noEmit` | `null` |
| `lint` | `scripts.lint` → `<pkg> run lint`; or eslint → `npx eslint .` | `null` |
| `test` | `scripts.test` → `<pkg> test`; or jest → `npx jest` | `null` |
| `build` | `scripts.build` → `<pkg> run build` | `null` |
| `format` | `scripts.format` → `<pkg> run format`; or prettier → `npx prettier --write .` | `null` |

Write the file. Use `null` for commands that don't apply.

## Step 6 — Obsidian (optional)

Ask, via AskUserQuestion:

> Do you use Obsidian as a knowledge base for technical notes?

Options:
- **Yes, set it up** — delegate to `/setup-obsidian` skill
- **No, skip**
- **Maybe later** — print a one-liner telling them they can run
  `/setup-obsidian` anytime

If yes, invoke the `setup-obsidian` skill (it handles vault selection and
writes `obsidianVaultPath` to `.claude/settings.local.json`). The
`session-start.sh` hook will pick it up automatically on the next session.

## Step 7 — Summary

Print a short summary:

```
Setup complete.

Stack: NestJS <v> on Node <v> with <pm>, <orm>, <test>.
Changes applied: <X fills, Y path rewrites, Z deletes>.
Files left as defaults: <list of untouched .claude/ files>.

Next time you open this repo, .claude/ will auto-load these rules and hooks.
```

## Rules

- **Never mutate files without running apply.ts** — the script is the only
  place that changes state, so the logic stays in one place and is testable.
- **Never re-implement detection inline** — if something's wrong with what
  detect.ts reports, fix detect.ts, don't work around it in conversation.
- **Default to --dry-run**. Only pass `--apply` after the user explicitly
  approves the plan.
- **Respect manual edits** — if the user has already customized a file, they
  may have removed the `<!-- CLAUDE_REPLACE:key -->` markers. apply.ts will
  log that as a warning and skip it. Don't force a replacement.
- **Abort on errors** — if detect.ts exits non-zero or apply.ts emits
  `[error]` entries, stop and show the user. Do not proceed to the next step.
- If the user passes `--yes`, skip the Step 2 and Step 4 confirmation prompts
  but still print the summary and plan before executing.
