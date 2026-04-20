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

**F. Skills** — for stack-specific skills (debug-fix, ship, hotfix, tdd, refactor, test-writer):
- If `--from` was used, review and adapt the copied skills
- Otherwise, copy from the closest existing stack (generic-ts for JS ecosystem, phoenix for non-JS) and adapt
- Key adaptations: test runner commands, build tools, file extensions, framework-specific debugging tips

## Step 5: Validate

After all sections are filled:

1. Check that every rule file has valid frontmatter (description, alwaysApply, paths with real globs — not `**/*.TODO_ADD_GLOB`)
2. Check that `settings.json` has no placeholder comments in arrays
3. Check that no TODO markers remain in any file
4. Verify hooks are syntactically valid: `bash -n stacks/<stack-name>/hooks/*.sh`

Report any remaining issues to the user.

## Step 6: Test Merge

Run merge to verify the output looks correct:

```bash
npx tsx scaffolder/merge.ts <stack-name>
```

Show the user the output structure:
```bash
find output/<stack-name> -type f | sort
```

Ask if they want to review any specific file in the output.

## Step 7: Done

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
