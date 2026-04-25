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

Run the research script with `--mapped` to get pre-mapped output for the fill step:

```bash
npx tsx scaffolder/research.ts <stack-name> --mapped
```

This fetches docs (from GitHub repo or URLs), analyzes exemplar repos, and maps the research
to STACK-FLAVOR sections. The mapped output shows which doc excerpts are relevant to each
section, and marks GAPs where no research coverage was found.

Read the mapped output. The file is saved at `.research-tmp/<stack-name>/research-mapped.md`.

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

**F. STACK-FLAVOR files** — two-pass fill using the pre-mapped research output.

Read the mapped research report at `.research-tmp/<stack-name>/research-mapped.md`.
This file contains research excerpts pre-matched to each STACK-FLAVOR section.

### Pass 1 — Research-sourced content only

For each skill/section in the mapped report:

1. Read the excerpts listed under that section
2. Draft content ONLY from what the excerpts contain:
   - If an excerpt describes a bug pattern, rewrite it as: **bold name** — symptom, root cause, fix
   - If an excerpt lists tools/commands, extract the concrete CLI invocations
   - If an excerpt describes a testing pattern, distill it into actionable steps with code examples
3. If a section is marked `<!-- GAP: No research excerpts found -->`, leave it as:
   `<!-- GAP: No research coverage. Needs manual fill or additional research. -->`
4. Do NOT fill from general knowledge in Pass 1. If you know something that isn't in the
   excerpts, do not write it yet — it goes in Pass 2.
5. After each skill's sections are drafted, present the draft to the user showing:
   - Which excerpts each piece of content came from
   - Which sections are marked as GAPs

Write the approved Pass 1 content to each STACK-FLAVOR.md file.

### Pass 2 — Fill gaps

After Pass 1 is complete for all skills, present the GAP summary to the user:

```
Pass 1 complete. The following sections have no research coverage:

- debug-fix / Common Bug Patterns: <!-- GAP -->
- review / Stack-Specific Review Patterns: <!-- GAP -->

For each gap, choose:
1. Fill from general knowledge (will be tagged [general knowledge])
2. Add more research sources (provide URLs, re-run research)
3. Skip this section (leave a note)
```

For each gap the user chooses to fill from general knowledge:
- Draft the content and tag it: `<!-- Filled from general knowledge — not sourced from docs -->`
- Present for user review before writing

### Rules for STACK-FLAVOR fill

- Do NOT copy content from another stack's STACK-FLAVOR.md
- Do NOT fill sections from general knowledge during Pass 1
- Every piece of content in Pass 1 must trace back to a specific research excerpt
- GAPs are expected and normal — they surface where the docs are insufficient
- Workflow skill methodology (SKILL.md) comes from `core/skills/` via merge.ts — do NOT write those files
- Only `setupdotclaude/SKILL.md` is stack-specific and needs manual authoring

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
