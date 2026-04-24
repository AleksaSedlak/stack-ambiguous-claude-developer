---
name: new-stack
description: Create a new stack template — scaffolds structure, assists research, guides you through filling each section interactively.
argument-hint: "<stack-name> [--from <existing-stack>]"
disable-model-invocation: true
---

Create a new stack template for: **$ARGUMENTS**

## Step 0: Parse Arguments

Extract from `$ARGUMENTS`:
- **stack-name** (required) — e.g., `nextjs`, `sveltekit`, `go`, `python-fastapi`
- **--from** (optional) — existing stack to copy as starting point

If no stack name is provided, ask the user.

## Step 1: Scaffold

Run the scaffold script:

```bash
npx tsx scaffolder/scaffold.ts <stack-name> [--from <existing-stack>]
```

If `--from` is specified, the scaffold copies an existing stack. Otherwise it creates skeleton files with TODO markers.

Confirm to the user what was created:
> Scaffolded `stacks/<stack-name>/` with skeleton files. Next: configure research sources.

## Step 2: Configure Research Sources

Read the generated `stacks/<stack-name>/stack.config.json`.

Ask the user to provide:
1. **Language & ecosystem** — e.g., "TypeScript / node" or "Go / go" or "Python / python"
2. **3-5 official doc URLs** — specific pages covering architecture, routing/handlers, data access, testing
3. **2-3 exemplar repos** — high-quality open-source projects using this stack (format: `owner/repo` or `owner/repo/subpath`)

Write their answers into `stack.config.json`.

Example prompt:
> I need research sources to help fill the template. Please provide:
>
> 1. What language and ecosystem? (e.g., "TypeScript / node")
> 2. 3-5 doc URLs covering the core patterns (routing, data fetching, project structure):
> 3. 2-3 exemplar repos (well-maintained, idiomatic, open-source):

## Step 3: Research

Run the research script:

```bash
npx tsx scaffolder/research.ts <stack-name>
```

This fetches the configured doc pages and analyzes exemplar repo structures. Read the output.

Summarize the key findings for the user:
- Project structure conventions discovered
- Key patterns observed across exemplars
- Commands detected (build, test, dev, lint)

## Step 4: Fill Sections Interactively

Work through each file in `stacks/<stack-name>/` that has TODO markers. For each section:

1. **Present a draft** based on research findings + your knowledge of the stack
2. **Ask for review** — the user approves, edits, or rejects
3. **Write the approved content**

### Order of files to fill:

**A. CLAUDE.md** — fill these sections:
- Commands (build, test, lint, dev, migrate)
- Architecture (project layout + boundary rules)
- Workflow
- Don'ts

**B. settings.json** — fill:
- `permissions.allow` (safe commands for this stack)
- `permissions.deny` (files/dirs to block)

**C. Rules** (one at a time, each gets its own review):
- `rules/code-quality.md` — naming, type safety, module boundaries
- `rules/testing.md` — test framework patterns, mocking rules
- `rules/api.md` — handler/controller patterns, validation, responses
- `rules/database.md` — ORM/query patterns, migrations, N+1 prevention
- `rules/error-handling.md` — error taxonomy, where to catch, structured responses
- `rules/security.md` — injection prevention, auth patterns, input validation

For rules, present each one with:
- Specific anti-patterns (with code examples where non-obvious)
- Framework idioms to follow
- What NOT to do and why

**D. Agents** — for each agent stub:
- Fill with stack-specific patterns to check
- Reference the security-reviewer from generic-ts or nestjs as a model

**E. Hooks** — customize:
- `protect-files.sh` — add lockfiles and stack-specific protected files
- `warn-large-files.sh` — add build output directories
- `format-on-save.sh` — add the stack's formatter command
- `session-start.sh` — add runtime/package manager detection

**F. STACK-FLAVOR files** — fill ecosystem-specific content using research output from Step 3.

Read `core/templates/skill-flavor-schema.json` for the list of skills that need a STACK-FLAVOR.md and their required sections.

For each skill with `requiresFlavor: true` (debug-fix, test-writer, tdd, refactor, review):
1. Read the STACK-FLAVOR.md stub in `stacks/<stack-name>/skills/<skill>/STACK-FLAVOR.md`
2. Each section has a `<!-- TODO: ... -->` guide explaining what to write and where to source it
3. Draft content using:
   - **Reproduction Tools / Verification Commands**: exemplar repo scripts, stack CLI docs
   - **Common Bug Patterns**: stack docs "gotchas"/"pitfalls" sections, exemplar issue trackers
   - **Framework Detection / Test Patterns / Mocking**: exemplar devDependencies and test directories
   - **Signature Examples / Validation Libraries**: stack type system docs
   - **Review Patterns**: stack linter rules, common anti-patterns from docs
4. Present each draft to the user for review
5. Write approved content — remove the `<!-- TODO: ... -->` comment

Do NOT copy content from another stack's STACK-FLAVOR.md — each stack's flavor must come from its own research output.

Note: workflow skill methodology (SKILL.md) comes from `core/skills/` via merge.ts — you do NOT need to write or copy those files. Only `setupdotclaude/SKILL.md` is stack-specific.

## Step 5: Validate

Run the canonical validation script:

```bash
npx tsx scaffolder/validate-stack.ts stacks/<stack-name>
```

This checks:
1. All required files exist (per `core/templates/stack-manifest.json`)
2. No forbidden content markers remain (`TODO_ADD_GLOB`, `<!-- EXAMPLE —`)
3. Required sections present in each rule file
4. Minimum line counts met for critical files
5. `settings.json` is valid JSON with no string comments in arrays
6. All hooks pass `bash -n` syntax check
7. No unlinked TODOs in rules/, agents/, or skills/
8. settings.json has no string comments in arrays
9. STACK-FLAVOR.md files exist for required skills
10. STACK-FLAVOR.md files have required sections per skill-flavor-schema.json

If any check fails, fix the issues and re-run. All checks must pass before proceeding.

## Step 6: Parity Test Against an Exemplar Repo

A stack is not done until it's been installed into a real repo and proven to do something useful.

1. Pick an exemplar repo listed in `stack.config.json` and clone it locally (if not already cloned from the research step — check `.research-tmp/<stack-name>/`).
2. Run the installer:
   ```bash
   npx tsx installer/install.ts <stack-name> <exemplar-path> --force
   ```
3. Inside the exemplar, run `/setupdotclaude`. It must complete without errors. If it errors, the CLAUDE.md commands or architecture section likely has issues — fix them and re-run.
4. Verify rule globs match real files: for each rule file with a `paths:` glob, run the glob against the exemplar and confirm it returns >0 files. If a rule matches nothing, its `paths:` is wrong for this stack's conventions.
5. Run `/pr-review` against the last merged commit on main. It must produce at least one finding (proves agents are not empty shells). If it produces zero findings on a non-trivial commit, the agents are under-specified — go back and add more specific patterns.
6. Run `validate-stack.ts` one final time (in case the parity test revealed content gaps that need fixing):
   ```bash
   npx tsx scaffolder/validate-stack.ts stacks/<stack-name>
   ```

Only after ALL steps in this parity test pass is the stack considered complete. "I filled in the files" is not the same as "this stack works."

## Step 7: Test Merge

Run merge to verify the output looks correct:

```bash
npx tsx scaffolder/merge.ts <stack-name>
```

Show the user the output structure:
```bash
find output/<stack-name> -type f | sort
```

Ask if they want to review any specific file in the output.

## Step 8: Done

```
Stack "<stack-name>" is ready!

To install into a project:
  npx tsx installer/install.ts <stack-name> /path/to/your/project

To regenerate after changes:
  npx tsx scaffolder/merge.ts <stack-name>
```

## Rules

- NEVER write security rules, "Don'ts", or opinionated architecture decisions without user approval
- NEVER skip the review step for any section — every draft needs explicit confirmation
- If the user says "skip" for a section, leave the TODO marker in place
- If you're unsure about a framework convention, say so and ask rather than guessing
- Cite sources: when drafting content from research findings, note which doc URL or exemplar repo it came from
- Keep rules under 150 lines each — split if longer
- Match the quality bar of existing stacks (nestjs, generic-ts) — not generic filler
