# Action Plan — New-Stack Pipeline + Autonomous Mode

Derived from the Claude Code review. Ordered by dependency: fix the foundation (research + validation) before adding rules that depend on those foundations being solid.

**How to use this file:** Work top-down. Each task has a copy-paste prompt for Claude Code. Check off tasks as you go. Don't skip Phase 1 — downstream phases assume the groundwork exists.

---

## Phase 1 — Fix the Broken Foundations

These unblock everything else. Until they're done, scaffolding a 4th stack produces garbage.

### Task 1.1 — Fix `research.ts` HTML extraction

- [x] Extraction preserves code blocks, headings, and preformatted text
- [x] `--section` flag actually filters what's dumped
- [x] Per-page cap is raised or made configurable (8k is too small for framework docs)
- [x] Output is structured markdown, not a wall of stripped text

**Prompt:**

````
Open `scaffolder/research.ts`. The HTML→text extraction is naive — it strips ALL tags including <code>, <pre>, <h1>, <h2>, producing undifferentiated text that's useless for drafting stack rules.

Fix it:

1. Replace the current stripping with a proper HTML→markdown conversion. Use `turndown` (or equivalent) so <code>, <pre>, <h1-h6>, <ul>, <table> are preserved as markdown.
2. The per-page character cap of 8000 is too small. Make it a flag (`--max-chars`, default 40000) and default to capturing enough to include actual content sections, not just the hero/nav.
3. The `--section` flag is documented but never applied in the logic. Implement it: when passed, filter the extracted markdown to only sections whose heading matches the given substring (case-insensitive).
4. Output should be one markdown file per source, with a clear `# Source: <url>` header at the top, then the structured content.

Before you commit: run it against one real doc URL (e.g. https://nestjs.com/docs/first-steps or whatever's in an existing stack.config.json) and show me 30 lines of the output. If the output is still a wall of text, you haven't fixed it.

Do NOT modify any existing stack. Only touch `scaffolder/research.ts` and its tests.
````

---

### Task 1.2 — Fix `research.ts` sparse clone

- [x] Cloned exemplar repos actually have files on disk
- [x] `find` on the clone returns real results
- [x] Sparse paths are configurable per stack

**Prompt:**

````
In `scaffolder/research.ts`, the exemplar repo clone uses `--filter=blob:none --sparse` but never runs `git sparse-checkout set <paths>`, so the working tree is empty and any subsequent `find` returns nothing.

Fix it:

1. After the clone, run `git sparse-checkout set <paths>` using paths configured in `stack.config.json` under `exemplars[].sparsePaths` (e.g. `["src/**", "test/**", "nest-cli.json", "package.json"]`).
2. If `sparsePaths` is missing in the config, default to a full clone (just warn that it'll be slow).
3. After checkout, verify at least one file exists in the working tree. If not, fail loudly — don't silently produce an empty research output.
4. Update the scaffold template's `stack.config.json` stub to include a `sparsePaths` field with a comment explaining what it's for.

Test it against whatever exemplar is currently in `stacks/nestjs/stack.config.json`. Show me the output of `find <clone-path> -type f | head -20` after the fix.
````

---

### Task 1.3 — Scaffold produces invalid JSON and empty skills directories

- [x] `settings.json` is valid JSON (no string comments inside arrays)
- [x] Every `skills/<name>/` directory has a `SKILL.md` stub inside it
- [x] `CLAUDE.local.md.example` exists
- [x] Stack-level `.gitignore` exists

**Prompt:**

````
Open `scaffolder/scaffold.ts`. It currently produces output with two blocking issues:

1. `settings.json` contains `// TODO: ...` strings inside JSON arrays. That's invalid JSON and breaks any parser. Remove the inline comments from the JSON entirely. If guidance is needed, put it in a sibling file `settings.README.md` explaining each field.

2. Skill directories (`skills/debug-fix/`, `skills/ship/`, `skills/hotfix/`, `skills/tdd/`, `skills/refactor/`, `skills/test-writer/`, `skills/setupdotclaude/`) are created as empty folders. Generate a `SKILL.md` stub inside each, following the structure used by existing NestJS skill files: frontmatter (name, description, when-to-use), then section headers (## Steps, ## Inputs, ## Outputs, ## Stop conditions) with 1-2 example bullets per section marked `<!-- EXAMPLE — replace -->`.

3. Generate `CLAUDE.local.md.example` at the stack root with placeholder sections for user-specific overrides.

4. Generate `.gitignore` at the stack root covering the stack's build outputs (ask the user at scaffold time: "What are this stack's build outputs?" — default to empty if skipped).

Show me `ls -la` of a freshly scaffolded stack before and after your changes.
````

---

### Task 1.4 — Replace vague TODO stubs with filled example templates

- [x] Each rule file has pre-filled section headers (not just bullet labels)
- [x] Each section has 1-2 example rules marked as examples to replace
- [x] Examples use the anti-pattern → fix format

**Prompt:**

````
The TODO stubs in scaffolded rule files (e.g. `## TODO: Fill in code quality rules` followed by bullet labels like `- Naming conventions`) are labels, not templates. An AI filling them out produces generic filler because there's no structural guidance or quality floor.

Replace the stubs in `scaffolder/scaffold.ts` (or wherever the rule templates live) so that each rule file ships with:

1. Pre-filled section headers appropriate to the file:
   - `code-quality.md` → ## Principles, ## Language/Type Safety, ## Naming, ## Patterns, ## Comments
   - `testing.md` → ## Principles, ## Naming, ## Structure, ## Mocking, ## Coverage
   - `security.md` → ## Input Validation, ## Injection Prevention, ## Authentication, ## Authorization, ## Secrets, ## Dependencies
   - `error-handling.md` → ## Error Classes, ## Async Error Flow, ## HTTP Boundaries, ## Logging
   - `workflow.md` → ## Pre-commit Verification, ## Stop Conditions, ## Recovery Protocol, ## Commit Hygiene

2. Under each header, 1-2 example rules in the anti-pattern → fix format, wrapped in:
   ```
   <!-- EXAMPLE — replace with stack-specific content -->
   **Don't:** <brief anti-pattern>
   **Do:** <brief fix>
   **Why:** <1-2 sentence reason>
   <!-- /EXAMPLE -->
   ```

3. A header comment at the top of each file:
   ```
   <!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real stack-specific rules, or remove them if they don't apply. Do not leave any <!-- EXAMPLE --> blocks in a finished stack — `validate-stack.ts` will fail. -->
   ```

This gives a floor (the examples) and a ceiling (clear sections to fill) instead of a blank page.
````

---

## Phase 2 — Enforce Quality Across Stacks

Now that the scaffold produces usable output, add the mechanisms that actually check a finished stack is good enough.

### Task 2.1 — Create the stack manifest

- [x] `core/templates/stack-manifest.json` exists
- [x] Manifest covers required files, required sections per rule, minimum line counts
- [x] Manifest is consumed by `validate-stack.ts` (next task)

**Prompt:**

````
Create `core/templates/stack-manifest.json` describing the minimum bar for a stack to be considered complete.

Use this structure:

```json
{
  "requiredFiles": [
    "CLAUDE.md",
    "settings.json",
    "rules/code-quality.md",
    "rules/testing.md",
    "rules/security.md",
    "rules/error-handling.md",
    "rules/workflow.md",
    "agents/code-reviewer.md",
    "agents/security-reviewer.md",
    "hooks/protect-files.sh",
    "hooks/warn-large-files.sh",
    "hooks/format-on-save.sh",
    "hooks/session-start.sh"
  ],
  "minimumRuleSections": {
    "rules/security.md": ["Input Validation", "Injection Prevention", "Authentication", "Secrets"],
    "rules/testing.md": ["Principles", "Naming", "Mocking"],
    "rules/error-handling.md": ["Error Classes", "Async Error Flow", "HTTP Boundaries"],
    "rules/code-quality.md": ["Principles", "Naming"],
    "rules/workflow.md": ["Pre-commit Verification", "Stop Conditions", "Recovery Protocol"]
  },
  "minimumLineCounts": {
    "rules/security.md": 60,
    "rules/code-quality.md": 40,
    "rules/testing.md": 40,
    "rules/error-handling.md": 40,
    "rules/workflow.md": 60,
    "agents/code-reviewer.md": 30,
    "agents/security-reviewer.md": 40
  },
  "forbiddenContent": [
    "TODO_ADD_GLOB",
    "<!-- EXAMPLE —"
  ]
}
```

Do NOT apply this to existing stacks — if they fail, we deal with that separately. Only new scaffolds must pass.
````

---

### Task 2.2 — Create `validate-stack.ts`

- [x] Script reads the manifest and validates a given stack path
- [x] Checks required files exist
- [x] Checks each rule has required sections (grep for `## Section`)
- [x] Checks minimum line counts
- [x] Checks no forbidden content markers remain
- [x] Checks `settings.json` parses as valid JSON
- [x] Checks each hook passes `bash -n`
- [x] Exits non-zero on any failure with specific messages

**Prompt:**

````
Create `scaffolder/validate-stack.ts` that validates a stack against `core/templates/stack-manifest.json`.

CLI: `tsx scaffolder/validate-stack.ts stacks/<name>`

Checks to implement, in order, with a clear PASS/FAIL line for each:

1. **Required files exist.** For each path in `manifest.requiredFiles`, check it exists. Report missing files.

2. **No forbidden content.** Grep every file in the stack for strings in `manifest.forbiddenContent`. Report matches with file:line.

3. **Required sections present.** For each rule in `manifest.minimumRuleSections`, parse the file and check every listed section header exists as a `## ` heading (case-insensitive match). Report missing sections.

4. **Minimum line counts met.** For each path in `manifest.minimumLineCounts`, count non-blank, non-comment-only lines. Report files below minimum.

5. **settings.json valid JSON.** `JSON.parse` it. On failure, print the parse error with line/col.

6. **Hooks pass bash -n.** Run `bash -n <hook>` on each `*.sh` in `hooks/`. Report syntax errors.

7. **No TODOs in rule files.** Grep `rules/` and `agents/` for `TODO` (case-insensitive) not followed by a URL or issue reference. Report matches.

8. **settings.json has no string comments in arrays.** Parse the JSON and walk arrays; flag any array element that starts with `//` or `#`.

Exit 0 if all pass, 1 otherwise. Print a summary at the end: "X of Y checks passed."

Wire it into `/new-stack` Step 5 as the canonical validation — replace whatever ad-hoc greps are currently there.
````

---

### Task 2.3 — Add exemplar-repo parity test to `/new-stack`

- [x] After filling the stack, the skill walks the user through installing it into an exemplar repo
- [x] `/setupdotclaude` must run cleanly
- [x] Rule globs must match at least some files in the exemplar
- [x] `/pr-review` must produce at least one finding on a recent commit

**Prompt:**

````
Update `core/skills/new-stack/SKILL.md`. Step 5 currently only checks for leftover TODOs and syntax. Add Step 6 — "Parity test against an exemplar repo":

```
## Step 6 — Parity test

A stack is not done until it's been installed into a real repo and proven to do something useful.

1. Pick an exemplar repo listed in `stack.config.json` and clone it locally (if not already).
2. Run the installer: `tsx installer/install.ts <stack-name> <exemplar-path>`
3. Inside the exemplar, run `/setupdotclaude`. It must complete without errors.
4. Verify rule globs match real files: for each rule file with a `paths:` glob, run the glob and confirm it returns >0 files.
5. Run `/pr-review` against the last merged commit on main. It must produce at least one finding (proves agents are not empty shells). If it produces zero findings on a non-trivial commit, the agents are under-specified.
6. Run `validate-stack.ts` one more time (in case step 5 revealed gaps).

Only after all 6 steps pass is the stack considered complete.
```

Do not loosen any check. The point is that "I filled in some files" is not the same as "this stack works."
````

---

## Phase 3 — Compose, Don't Replace (Core ↔ Stack Hooks)

### Task 3.1 — Make stack hooks extend core hooks instead of replacing

- [x] Stack hooks source core hook content or chain after it
- [x] A stack that "forgets" `.env` protection still gets it from core
- [x] Merge logic documented

**Prompt:**

````
Current behavior: when merging `core/hooks/protect-files.sh` with `stacks/<name>/hooks/protect-files.sh`, the stack version REPLACES core entirely. That means if a new stack's `protect-files.sh` forgets `.env`, the universal protection is lost.

Fix this in `scaffolder/merge.ts`:

1. For each hook in `core/hooks/`, if a stack has a same-named hook, produce a merged hook that:
   - Runs the core hook's checks first
   - Then runs the stack-specific additions
   - Fails if either block fails

2. Easiest implementation: emit a wrapper hook that `source`s both. Structure:
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   # --- BEGIN core/hooks/<name>.sh ---
   <inlined core content>
   # --- END core ---
   # --- BEGIN stacks/<stack>/hooks/<name>.sh ---
   <inlined stack content>
   # --- END stack ---
   ```

3. Alternative (cleaner): keep them as separate files in output and have a wrapper `hooks/<name>.sh` that calls both. Pick whichever fits better with how Claude Code executes hooks — verify by testing one end to end.

4. Document the composition rule in `core/templates/README.md` (create if missing): "Stack hooks EXTEND core hooks. Do not duplicate core checks in your stack hook."

Test: scaffold a fresh stack, give its `protect-files.sh` a single custom pattern (e.g. `*.lock`), install it, and verify BOTH `.env` (from core) and `*.lock` (from stack) are protected.
````

---

## Phase 4 — Autonomous Mode Rules

Add the rule files that make "prompt to commit" actually safe. Put these in `core/rules/` so every stack inherits them, unless stack-specific overrides are needed.

### Task 4.1 — Pre-commit verification rule

**Prompt:**

````
Create `core/rules/autonomous-commit.md` with frontmatter `alwaysApply: true` (it governs agent behavior, not file patterns) and the following content:

```markdown
---
alwaysApply: true
description: Verification checklist the agent must pass before committing in autonomous mode.
---

# Pre-commit Verification

Before creating any commit, the agent MUST verify ALL of the following pass:

1. **Type check**: the stack's type-check command exits 0 (e.g. `tsc --noEmit`, `mix compile --warnings-as-errors`)
2. **Lint**: the stack's lint command exits 0 (warnings OK, errors not)
3. **Tests**: full test suite passes, not just the ones you touched
4. **Build** (if changed code is in the build path): build exits 0
5. **No leftover debug code**: grep staged files for `console.log`, `debugger`, `.only(`, `IO.inspect`, `dbg`, `binding.pry`
6. **Diff size sanity**: if staged diff exceeds 500 lines, split into multiple commits
7. **No new TODOs without issue links**: staged files must not contain `TODO` without a `#NNN` reference

If ANY check fails, fix it before committing. If a test failure cannot be fixed after 3 attempts, STOP and ask the user — do not commit with failing tests and do not disable the test.

The exact commands for this stack are defined in `.claude/workflow-commands.json` at stack install time (setupdotclaude fills them).
```

Also update `/setupdotclaude` to prompt for and generate `.claude/workflow-commands.json` with keys: `typecheck`, `lint`, `test`, `build`, `format`. Detect defaults from `package.json`, `mix.exs`, etc. where possible.
````

---

### Task 4.2 — Stop-and-ask triggers rule

**Prompt:**

````
Create `core/rules/stop-conditions.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: Conditions under which the agent must halt and ask the user, rather than proceed with an assumption.
---

# Mandatory Stop Conditions

STOP and ask the user (do not proceed with an assumption) when:

- Requirements are ambiguous and the two most likely interpretations would produce >20 lines of different code
- Tests fail and you cannot fix them within 3 edit-run cycles
- The change requires a new database migration
- The change adds or removes a dependency from the stack's manifest (package.json, mix.exs, Cargo.toml, etc.)
- The change modifies authentication, authorization, or payment logic
- The change deletes >50 lines of code that is not obviously dead (dead = zero imports, zero references, not exported publicly)
- The change modifies a public API contract: route paths, HTTP methods, response shapes, exported function signatures, published event schemas
- You need to modify files in >5 different directories for one logical change
- The change requires environment variables that don't exist in `.env.example`
- You're unsure whether a file is dead code or used dynamically (string import, reflection, config-driven loading)
- A hook blocks an operation you believe should succeed

When stopping: state (1) what you were trying to do, (2) which condition triggered the stop, (3) the two or three options you see, (4) your recommendation.
```
````

---

### Task 4.3 — Recovery protocol rule

**Prompt:**

````
Create `core/rules/recovery.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: What to do when tests fail, when a fix regresses, or when the agent realizes its approach is wrong.
---

# Recovery Protocol

## When tests fail after an edit

1. Re-read the failing test AND the file you changed (do not rely on cached understanding)
2. Determine if your edit caused the failure or it was pre-existing: `git stash && <test command> && git stash pop`
3. If your edit caused it: fix it. Max 3 attempts. On attempt 4, STOP and ask.
4. If pre-existing: note it to the user in your next message, but do not block your commit on it

## When a fix breaks something else (regression)

1. Run `git diff` to see all changes since last green state
2. Identify the most recent edit likely to have caused the regression
3. Revert that edit (`git checkout -- <file>`) and re-run tests
4. If green, try a different approach for the original problem
5. If still red, the regression was elsewhere — widen the bisect

## When you realize the approach is wrong after 5+ edits

1. STOP. Do not make "just one more fix."
2. `git stash` all uncommitted changes
3. Write a short message to the user: what you tried, why it didn't work, what you'd try instead, whether to continue
4. Wait for confirmation before starting over

## Never

- Never delete a test because it fails. If a test is wrong, say so and propose a fix to the test with rationale — then wait.
- Never add `.skip`, `.only`, or equivalent to bypass a red test without user confirmation.
- Never commit with `--no-verify` or bypass hooks.
```
````

---

### Task 4.4 — Commit hygiene, branch discipline, destructive ops

**Prompt:**

````
Create `core/rules/commit-and-branch.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: Commit, branch, and destructive-operation rules for autonomous mode.
---

# Commit Rules

- **One logical change per commit.** A bug fix is one commit. A refactor is another. Never mix.
- **Max 300 lines per commit** excluding generated files and lockfiles. If larger, split into stacked commits.
- **Conventional Commits.** Subject ≤72 chars, imperative mood, type prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).
- **Body explains WHY.** The diff shows what changed; the commit message explains motivation.
- **Never commit**: `.env`, lockfile changes not tied to an intentional dependency change, debug logs, commented-out code, files containing scaffold markers.
- **Never amend a pushed commit** unless the user explicitly asks.

# Branch Rules

- NEVER commit directly to `main`, `master`, `develop`, or any protected branch. Verify by checking branch protection config if unclear.
- Branch naming: `<type>/<short-kebab-description>` — e.g. `feat/user-registration`, `fix/null-avatar`, `refactor/extract-auth-service`.
- One branch per task. Do not pile unrelated changes onto the same branch.
- Push the branch after the first meaningful commit so work isn't lost locally.
- Open a PR only when: the change is complete, all pre-commit checks pass, and the diff is ready for human review.

# Destructive Operations — Always Ask First

Require explicit user confirmation BEFORE executing any of:

- Creating or modifying a database migration
- Deleting any file (not just editing it)
- `git reset --hard`, `git rebase` on shared branches, `git push --force` or `--force-with-lease`
- Modifying `.claude/settings.json` or any file in `.claude/hooks/`
- Any command with `--force`, `--hard`, or `--delete`
- Dropping, truncating, or seeding database tables
- Modifying CI/CD configuration (`.github/`, `.gitlab-ci.yml`, etc.)
- Publishing packages (`npm publish`, `mix hex.publish`, `cargo publish`)
- Regenerating lockfiles from scratch
```
````

---

### Task 4.5 — Context discipline and determinism

**Prompt:**

````
Create `core/rules/context-discipline.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: How the agent keeps its mental model accurate in long autonomous runs.
---

# Context Discipline

- After 30+ tool calls in a session, re-read any file you're about to edit. Cached understanding is stale.
- After running a fix that changes behavior, re-read the test file to confirm what it actually asserts.
- If you've made 5+ edits to the same file in one session, read it top-to-bottom once to check for inconsistencies you introduced.
- Never assume a function signature hasn't changed if other edits have intervened.
- When you rename or move a symbol, grep for it immediately after the edit to confirm no callers are broken.
- When working across multiple files, verify imports still resolve after any rename.

# Determinism

- Do not rely on `Date.now()`, `Math.random()`, or other non-deterministic values in production code unless the feature explicitly requires it. When required, isolate behind an injectable dependency.
- Test factories and fixtures must produce deterministic output. Sequential IDs, not `crypto.randomUUID()`. Fixed dates, not `new Date()`.
- If code depends on execution order (Promise.race, event ordering, stream scheduling), add a comment explaining the ordering assumption.
- Running the same task prompt against the same codebase state should produce functionally equivalent output. If it wouldn't, the prompt or the code is under-specified — flag it.
```
````

---

### Task 4.6 — Dependency change policy

**Prompt:**

````
Create `core/rules/dependencies.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: When dependency changes are allowed without asking, and when they require confirmation.
---

# Dependency Changes

## Adding a dependency — always ask

Before adding any runtime or dev dependency:

1. State the package name, what it does, weekly downloads, and last publish date
2. State why you can't solve this without the dependency, or why the dep is significantly better than a hand-rolled solution
3. Confirm the project doesn't already have a package providing the same functionality

Wait for confirmation. Do not add the dependency first and ask for forgiveness.

## Upgrading

- **Patch versions within existing range**: allowed without asking
- **Minor versions**: allowed without asking ONLY if the package's semver is trustworthy (well-known libraries with stable changelogs)
- **Major versions**: ALWAYS ask. Breaking changes are the default in major bumps.
- **Any upgrade that changes the lockfile for packages you did not intend to touch**: revert and investigate before committing.

## Removing a dependency

- Allowed without asking ONLY after confirming zero import sites remain (grep the full codebase for the package name, check for string imports and dynamic requires).
- If removal changes bundle size or runtime behavior of other packages (transitive removal), ask.
```
````

---

### Task 4.7 — Required hook coverage for autonomous mode

**Prompt:**

````
Create `core/rules/autonomous-mode-requirements.md` with frontmatter `alwaysApply: true`:

```markdown
---
alwaysApply: true
description: Conditions that must be true for the agent to operate in autonomous (prompt-to-commit) mode.
---

# Autonomous Mode — Required Hook Coverage

For autonomous prompt-to-commit to be safe, these hooks MUST be active:

| Hook | Trigger | What it catches |
|------|---------|-----------------|
| protect-files.sh | PreToolUse (Edit/Write) | Edits to `.env`, secrets, lockfiles, hooks themselves |
| warn-large-files.sh | PreToolUse (Edit/Write) | Writes to build output, `node_modules`, binaries |
| scan-secrets.sh | PreToolUse (Edit/Write) | API keys, tokens, credentials in content being written |
| block-dangerous-commands.sh | PreToolUse (Bash) | Force push, `reset --hard`, push to main, `npm publish`, `DROP TABLE` |
| format-on-save.sh | PostToolUse (Edit/Write) | Consistent formatting without agent effort |

At session start, verify each hook is present and executable. If any is missing or disabled, the agent MUST NOT proceed in autonomous mode — degrade to "propose and wait" for every edit.

# Autonomous Mode Definition

Autonomous mode = agent commits without the user reviewing each change before commit.

The agent operates in autonomous mode ONLY when:

1. All required hooks are active (verified at session start)
2. The task is scoped to a feature branch, not `main`/`master`
3. The user has either explicitly enabled it for this session OR the prompt contains a clear "prompt-to-commit" intent (e.g., "implement X and commit", "ship a fix for Y")
4. No stop condition from `stop-conditions.md` has been triggered

Otherwise: default to "propose edit → apply → show diff → wait" for each significant change.
```
````

---

## Phase 5 — Token Economy

### Task 5.1 — Split oversized `alwaysApply` rules

- [x] `code-quality.md` split: principles (≤20 lines, alwaysApply) + language specifics (scoped by paths)
- [x] `testing.md` scoped to test file paths only
- [x] `workflow.md` trimmed below 50 lines where possible; overflow moved to scoped rules
- [x] Criteria for `alwaysApply: true` documented

**Prompt:**

````
Current generic-ts stack has ~330 lines of `alwaysApply: true` rules loaded every turn. Most turns don't need most of that context.

Establish a policy and apply it to generic-ts (NOT nestjs or phoenix — those are out of scope for this pass).

1. Add to `core/templates/README.md` (create if missing):

   ```
   ## alwaysApply criteria

   A rule file gets `alwaysApply: true` ONLY if BOTH:
   - It applies to literally every edit regardless of file type (agent behavior, commit rules, stop conditions), AND
   - It is under 50 lines

   Everything else uses `paths:` scoping. Language-specific or file-type-specific rules must be path-scoped.
   ```

2. Refactor `stacks/generic-ts/rules/`:
   - Split `code-quality.md` into `code-quality-principles.md` (≤20 lines, alwaysApply) and `typescript-specifics.md` (paths: `**/*.ts`, `**/*.tsx`)
   - Change `testing.md` to scoped: `paths: ["**/*.test.*", "**/*.spec.*", "tests/**", "test/**"]`
   - Trim `workflow.md` to the essentials; move file-size guidance and observability notes to a scoped rule or a separate file

3. Do NOT touch the core autonomous-mode rules from Phase 4 — those are correctly `alwaysApply: true` because they govern agent behavior on every action.

4. After the split, print the total line count of `alwaysApply: true` content in generic-ts. Target: under 200 lines.
````

---

## Phase 6 — End-to-End Validation

### Task 6.1 — Create a 4th stack as an integration test

- [x] Fresh stack scaffolded using the fixed pipeline
- [x] Research step produces usable output
- [x] Stubs guide a complete fill
- [x] `validate-stack.ts` passes (38/38)
- [ ] Exemplar parity test passes (requires installing into a real FastAPI repo — deferred to manual)
- [ ] `/pr-review` produces real findings (requires a real repo with commits — deferred to manual)

**Prompt:**

````
Now validate everything end to end. Pick a stack that's genuinely different from the existing three — suggestion: Python/FastAPI, Go, or Rust/Axum. Ask me which before starting.

Run the full pipeline:

1. `tsx scaffolder/scaffold.ts <chosen-stack>`
2. Fill `stack.config.json` with 2-3 doc URLs and 1-2 exemplar repos
3. `tsx scaffolder/research.ts <chosen-stack>` — verify the output is structured and usable, not a wall of stripped HTML
4. Use `/new-stack` to fill each file section by section, leaning on the research output
5. `tsx scaffolder/validate-stack.ts stacks/<chosen-stack>` — must pass all checks
6. Install into an exemplar repo and run the Step 6 parity test from Task 2.3
7. Run `/pr-review` against a recent non-trivial commit on the exemplar — confirm it produces real findings

Report back:
- Where the pipeline still friction-ed (be specific, file and step)
- Which TODO stubs helped vs which were still useless
- Whether `validate-stack.ts` caught real issues or was theatre
- Any rule from Phase 4 that felt wrong or missing in practice

Do NOT silently patch issues you encounter — log them as follow-up tasks at the bottom of this file.
````

---

## Follow-ups discovered during execution

<!-- As you work through the plan, add any issues you find below so they're tracked. -->

- [x] Each stack's `/setupdotclaude` skill should generate `.claude/workflow-commands.json` — **Done 2026-04-24.** Added to all 4 stacks' setupdotclaude.
- [x] SPA-rendered docs problem — **Done 2026-04-26.** Added `docsRepo` field to stack.config.json. research.ts clones docs repo from GitHub and reads raw markdown directly.
- [x] Skill files need stack-specific adaptation — **Done 2026-04-24.** STACK-FLAVOR split: methodology in core SKILL.md, ecosystem flavor in stacks STACK-FLAVOR.md. scaffold --from generates fresh stubs.
- [x] validate-stack.ts doesn't check skills/ — **Done 2026-04-24.** Added skills/ to TODO scan (Check 7), STACK-FLAVOR presence (Check 9), STACK-FLAVOR sections (Check 10).

### New follow-ups (2026-04-26)

- [ ] Build remaining stacks via pipeline: nextjs, react-native, phoenix, generic-ts, python-fastapi
- [ ] Fill Go stack rules/agents/hooks (currently scaffold stubs)
- [ ] Real-world parity test: install into actual project, run /setupdotclaude + /pr-review
- [ ] Test workflow-commands.json generation in a real project
- [ ] Test empty project defaults (Phase 1-alt in setupdotclaude)
- [ ] Test research pipeline with a sparse-docs framework (Gleam, Zig) to validate GAP handling

