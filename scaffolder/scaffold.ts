#!/usr/bin/env node
/**
 * scaffold.ts — Creates the folder structure for a new stack with TODO-marked files.
 *
 * Usage:
 *   npx tsx scaffolder/scaffold.ts <stack-name> [--from <existing-stack>]
 *
 * Examples:
 *   npx tsx scaffolder/scaffold.ts nextjs
 *   npx tsx scaffolder/scaffold.ts sveltekit --from generic-ts
 *
 * What it does:
 * 1. Creates stacks/<stack-name>/ with the standard folder structure
 * 2. If --from is specified, copies an existing stack as starting point
 * 3. Otherwise, creates skeleton files with TODO markers
 * 4. Creates a stack.config.json for research mode
 *
 * Zero dependencies — uses only Node built-ins.
 */

import { existsSync, mkdirSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── CLI Parsing ──────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const stackName = args.find((a) => !a.startsWith("--"));
const fromIdx = args.indexOf("--from");
const fromStack = fromIdx !== -1 ? args[fromIdx + 1] : undefined;

if (!stackName) {
  console.error("Usage: npx tsx scaffolder/scaffold.ts <stack-name> [--from <existing-stack>]");
  process.exit(1);
}

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = resolve(__dirname, "..");
const STACK_DIR = join(ROOT, "stacks", stackName);

if (existsSync(STACK_DIR)) {
  console.error(`Error: Stack "${stackName}" already exists at ${STACK_DIR}`);
  console.error("Delete it first if you want to start fresh.");
  process.exit(1);
}

// ─── Copy from existing stack ─────────────────────────────────────────────────

if (fromStack) {
  const sourceStack = join(ROOT, "stacks", fromStack);
  if (!existsSync(sourceStack)) {
    console.error(`Error: Source stack "${fromStack}" not found.`);
    process.exit(1);
  }
  cpSync(sourceStack, STACK_DIR, { recursive: true });
  console.log(`Scaffolded "${stackName}" from "${fromStack}".`);
  console.log(`Edit the files in ${STACK_DIR} to customize for ${stackName}.`);
  process.exit(0);
}

// ─── Create fresh scaffold ────────────────────────────────────────────────────

const dirs = [
  "skills/setupdotclaude",
  "skills/debug-fix",
  "skills/ship",
  "skills/hotfix",
  "skills/tdd",
  "skills/refactor",
  "skills/test-writer",
  "agents",
  "hooks",
  "rules",
];

for (const dir of dirs) {
  mkdirSync(join(STACK_DIR, dir), { recursive: true });
}

// ─── Skill SKILL.md stubs ─────────────────────────────────────────────────────

const skillStubs: Array<{ dir: string; name: string; description: string }> = [
  { dir: "skills/setupdotclaude", name: "setupdotclaude", description: "Scan the project and customize .claude/ configuration to match the actual stack" },
  { dir: "skills/debug-fix", name: "debug-fix", description: "Find and fix a bug — from any source (issue, error message, user report)" },
  { dir: "skills/ship", name: "ship", description: "Stage, commit, push, and prepare a PR — with confirmation at each step" },
  { dir: "skills/hotfix", name: "hotfix", description: "Emergency production fix — minimal change, critical tests only, ship fast" },
  { dir: "skills/tdd", name: "tdd", description: "Test-Driven Development loop — failing test first, minimal code to pass, refactor" },
  { dir: "skills/refactor", name: "refactor", description: "Safely refactor code with test coverage as a safety net" },
  { dir: "skills/test-writer", name: "test-writer", description: "Write comprehensive tests for new or changed code" },
];

for (const skill of skillStubs) {
  writeFileSync(
    join(STACK_DIR, skill.dir, "SKILL.md"),
    `---
name: ${skill.name}
description: ${skill.description}
argument-hint: "[describe what to ${skill.name}]"
disable-model-invocation: true
---

<!-- EXAMPLE — replace with stack-specific implementation -->
<!-- See stacks/generic-ts/skills/${skill.name}/SKILL.md or stacks/nestjs/skills/${skill.name}/SKILL.md for a complete example -->

## Steps

<!-- EXAMPLE — replace -->
- Step 1: Understand the request
- Step 2: Execute the core action
- Step 3: Verify the result
- Step 4: Report to the user
<!-- /EXAMPLE -->

## Stop Conditions

<!-- EXAMPLE — replace -->
- STOP if the change requires more than 50 lines and wasn't explicitly scoped
- STOP if tests fail after 3 fix attempts
- NEVER skip user confirmation at critical decision points
<!-- /EXAMPLE -->
`
  );
}

// ─── CLAUDE.md ────────────────────────────────────────────────────────────────

writeFileSync(
  join(STACK_DIR, "CLAUDE.md"),
  `# Project Instructions

## Commands

\`\`\`bash
# Dependencies
# TODO: Fill in dependency management commands for ${stackName}

# Build & type-check
# TODO: Fill in build/compile commands

# Test
# TODO: Fill in test runner commands (full suite, single file, by name)

# Lint & format
# TODO: Fill in linter and formatter commands

# Dev server
# TODO: Fill in development server command

# Database (if applicable)
# TODO: Fill in migration commands or remove this section
\`\`\`

## Architecture

<!-- TODO: Document the standard project layout for ${stackName}.
     Show a directory tree with annotations explaining each folder's purpose.
     Include boundary rules (what calls what, what's public vs internal). -->

## Key Decisions

> Record WHY non-obvious choices were made.

## Workflow

<!-- TODO: Fill in stack-specific workflow steps -->
- Run formatter before every commit
- After pulling, check for dependency changes and new migrations
- Keep controllers/handlers thin — business logic belongs in services/contexts

## Don'ts

<!-- TODO: Fill in stack-specific anti-patterns -->
- Don't modify existing migrations — always create a new one
- Don't put business logic in request handlers
- Don't commit secrets or .env files

## Obsidian Integration

This project may be connected to an Obsidian vault for persistent knowledge storage.

### Configuration

- Vault path is stored in \`settings.local.json\` under \`obsidianVaultPath\`
- If not configured, Obsidian features are inactive — no errors, just not available

### Memory

- Memories are written using the standard memory system (the directory is symlinked to the vault)
- Memories appear in Obsidian under \`Claude/<project>/memory/\`

### Reading vault context

- Use \`/context <keywords>\` to search the vault for relevant notes
- Treat vault notes as reference material — they may be outdated, always verify against current code

### Boundaries

- Never write directly to the vault root — only write through the memory system
- Never modify the user's existing notes — only read them
- Never read folders in the exclude list (\`obsidianExclude\` in settings.local.json)
`
);

// ─── settings.json ────────────────────────────────────────────────────────────

writeFileSync(
  join(STACK_DIR, "settings.json"),
  JSON.stringify(
    {
      permissions: {
        allow: [
          "Bash(git status*)",
          "Bash(git log*)",
          "Bash(git diff*)",
          "Bash(git branch*)",
          "Bash(git show*)",
          "Bash(git blame*)",
          "Bash(git remote*)",
        ],
        deny: [
          "Edit(.env)",
          "Write(.env)",
          "Edit(.env.*)",
          "Write(.env.*)",
        ],
      },
      hooks: {
        PreToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [
              ".claude/hooks/protect-files.sh",
              ".claude/hooks/warn-large-files.sh",
              ".claude/hooks/scan-secrets.sh",
            ],
          },
          {
            matcher: "Bash",
            hooks: [".claude/hooks/block-dangerous-commands.sh"],
          },
        ],
        PostToolUse: [
          {
            matcher: "Edit|Write",
            hooks: [".claude/hooks/format-on-save.sh"],
          },
        ],
        SessionStart: [".claude/hooks/session-start.sh"],
      },
    },
    null,
    2
  ) + "\n"
);

// settings.README.md — explains what to customize in settings.json
writeFileSync(
  join(STACK_DIR, "settings.README.md"),
  `# settings.json — Customization Guide

## permissions.allow

Add safe, read-only, and dev commands for this stack. Examples:

- Node: \`Bash(npm test*)\`, \`Bash(npx tsc*)\`, \`Bash(npx vitest*)\`
- Python: \`Bash(pytest*)\`, \`Bash(ruff*)\`, \`Bash(mypy*)\`
- Go: \`Bash(go test*)\`, \`Bash(go build*)\`, \`Bash(golangci-lint*)\`
- Elixir: \`Bash(mix test*)\`, \`Bash(mix compile*)\`, \`Bash(mix format*)\`

## permissions.deny

Add files and directories that should never be edited. Examples:

- Lockfiles: \`Edit(package-lock.json)\`, \`Edit(pnpm-lock.yaml)\`
- Build output: \`Edit(dist/**)\`, \`Write(dist/**)\`
- Dependencies: \`Edit(node_modules/**)\`, \`Write(vendor/**)\`

## hooks

The hook configuration is pre-wired. Customize the hook SCRIPTS in \`hooks/\`,
not the hook wiring here (unless adding new hook triggers).
`
);

// ─── Rule stubs ───────────────────────────────────────────────────────────────

const ruleStubs = [
  {
    name: "code-quality",
    description: `Code quality patterns for ${stackName}`,
    alwaysApply: true,
    content: `## TODO: Fill in code quality rules
- Naming conventions
- Type safety rules
- Module boundary rules
- Import/export conventions`,
  },
  {
    name: "testing",
    description: `Testing patterns for ${stackName}`,
    alwaysApply: true,
    content: `## TODO: Fill in testing rules
- Test framework and conventions
- Arrange-Act-Assert structure
- Mocking boundaries
- Test organization (co-located vs separate)`,
  },
  {
    name: "api",
    description: `API/handler patterns for ${stackName}`,
    alwaysApply: false,
    content: `## TODO: Fill in API rules
- Request handling patterns
- Input validation
- Response formatting
- Error responses
- Pagination
- Rate limiting`,
  },
  {
    name: "database",
    description: `Database access patterns for ${stackName}`,
    alwaysApply: false,
    content: `## TODO: Fill in database rules
- Migration conventions
- Query patterns (avoid N+1)
- Transaction handling
- Connection pooling
- Schema conventions`,
  },
  {
    name: "security",
    description: `Security patterns for ${stackName}`,
    alwaysApply: false,
    content: `## TODO: Fill in security rules
- Input validation at boundaries
- Injection prevention (SQL, command, template)
- Authentication patterns
- Authorization patterns
- Secrets management
- CORS/CSRF`,
  },
  {
    name: "error-handling",
    description: `Error handling patterns for ${stackName}`,
    alwaysApply: false,
    content: `## TODO: Fill in error handling rules
- Error taxonomy (classes/types)
- Where to catch vs propagate
- Structured error responses
- Logging conventions
- Retry patterns`,
  },
];

for (const rule of ruleStubs) {
  writeFileSync(
    join(STACK_DIR, "rules", `${rule.name}.md`),
    `---
description: ${rule.description}
alwaysApply: ${rule.alwaysApply}
paths:
  - "**/*.TODO_ADD_GLOB"
---

${rule.content}
`
  );
}

// ─── Agent stubs ──────────────────────────────────────────────────────────────

const agentStubs = [
  { name: "code-reviewer", desc: `Reviews ${stackName} code for quality and correctness` },
  { name: "security-reviewer", desc: `Reviews ${stackName} code for security vulnerabilities` },
  { name: "performance-reviewer", desc: `Reviews ${stackName} code for performance issues` },
  { name: "doc-reviewer", desc: `Reviews documentation for accuracy and completeness` },
];

for (const agent of agentStubs) {
  writeFileSync(
    join(STACK_DIR, "agents", `${agent.name}.md`),
    `---
name: ${agent.name}
description: ${agent.desc}
tools:
  - Read
  - Grep
  - Glob
  - Bash
---

## TODO: Fill in review patterns for ${stackName}

See existing stacks (generic-ts, nestjs, phoenix) for examples of what to include.
Each agent should have:
1. How to Review (discover changed files)
2. Specific patterns to catch (organized by category)
3. What NOT to flag
4. Output format (File:Line — Issue — Fix)
`
  );
}

// ─── Hook stubs ───────────────────────────────────────────────────────────────

// protect-files.sh — stack-specific protected patterns
writeFileSync(
  join(STACK_DIR, "hooks", "protect-files.sh"),
  `#!/bin/bash
# Blocks edits to sensitive or generated files.
# Used as a PreToolUse hook for Edit|Write operations.
# Exit 2 = block the action. Exit 0 = allow.
#
# TODO: Customize PROTECTED_PATTERNS and directory blocks for ${stackName}

if ! command -v jq >/dev/null 2>&1; then
  echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"jq is required for file protection hooks but is not installed.\\"}}"
  exit 2
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# TODO: Add stack-specific protected patterns
PROTECTED_PATTERNS=(
  ".env"
  ".env.*"
  "*.pem"
  "*.key"
  "*.crt"
  "*.p12"
  "*.pfx"
  "id_rsa"
  "id_ed25519"
  "credentials.json"
)

BASENAME=$(basename "$FILE_PATH")

for pattern in "\${PROTECTED_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Protected file: $BASENAME matches pattern '$pattern'\\"}}"
      exit 2
      ;;
  esac
done

# TODO: Add stack-specific directory blocks
case "$FILE_PATH" in
  .git/*|*/.git/*)
    echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Cannot edit files inside .git/\\"}}"
    exit 2
    ;;
  .claude/hooks/*|*/.claude/hooks/*)
    echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"Cannot edit hook scripts — these enforce security boundaries.\\"}}"
    exit 2
    ;;
esac

exit 0
`
);

// warn-large-files.sh — stack-specific build artifact dirs
writeFileSync(
  join(STACK_DIR, "hooks", "warn-large-files.sh"),
  `#!/bin/bash
# Blocks writes to build artifacts and generated directories.
# Used as a PreToolUse hook for Edit|Write operations.
# Exit 2 = block the action. Exit 0 = allow.
#
# TODO: Customize blocked directories for ${stackName}

if ! command -v jq >/dev/null 2>&1; then
  echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"jq is required for file protection hooks but is not installed.\\"}}"
  exit 2
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# TODO: Add stack-specific build output directories
case "$FILE_PATH" in
  # Example patterns — customize for your stack:
  # node_modules/*|*/node_modules/*) REASON="Managed by package manager" ;;
  # dist/*|*/dist/*) REASON="Generated by build" ;;
  # _build/*|*/_build/*) REASON="Generated by compiler" ;;
  # target/*|*/target/*) REASON="Generated by compiler" ;;
  *) REASON="" ;;
esac

if [ -n "$REASON" ]; then
  echo "{\\"hookSpecificOutput\\":{\\"hookEventName\\":\\"PreToolUse\\",\\"permissionDecision\\":\\"deny\\",\\"permissionDecisionReason\\":\\"$REASON\\"}}"
  exit 2
fi

exit 0
`
);

// format-on-save.sh — stack-specific formatter
writeFileSync(
  join(STACK_DIR, "hooks", "format-on-save.sh"),
  `#!/bin/bash
# Auto-formats files after Claude edits them.
# Used as a PostToolUse hook for Edit|Write operations.
# Never blocks — exits 0 on any failure so writes aren't interrupted.
#
# TODO: Customize for ${stackName}'s formatter

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# TODO: Add file extension filter and formatter command
# Example for Node: prettier --write "$FILE_PATH"
# Example for Elixir: mix format "$FILE_PATH"
# Example for Go: gofmt -w "$FILE_PATH"
# Example for Rust: rustfmt "$FILE_PATH"
# Example for Python: ruff format "$FILE_PATH"

exit 0
`
);

// session-start.sh — stack-specific context
writeFileSync(
  join(STACK_DIR, "hooks", "session-start.sh"),
  `#!/bin/bash
# Injects dynamic project context at session start.
# Used as a SessionStart hook.
# TODO: Add stack-specific context (runtime version, package manager, etc.)

CONTEXT=""

# Current branch (or detached HEAD)
BRANCH=$(git branch --show-current 2>/dev/null)
if [ -n "$BRANCH" ]; then
  CONTEXT="Branch: $BRANCH"
elif git rev-parse --git-dir >/dev/null 2>&1; then
  SHORT_SHA=$(git rev-parse --short HEAD 2>/dev/null)
  CONTEXT="HEAD: detached at $SHORT_SHA"
fi

# Last commit
LAST_COMMIT=$(git log --oneline -1 2>/dev/null)
if [ -n "$LAST_COMMIT" ]; then
  CONTEXT="$CONTEXT | Last commit: $LAST_COMMIT"
fi

# Uncommitted changes count
CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
if [ "$CHANGES" -gt 0 ] 2>/dev/null; then
  CONTEXT="$CONTEXT | Uncommitted changes: $CHANGES files"
fi

# TODO: Add stack-specific context detection
# Example for Node: detect package manager from lockfile
# Example for Python: detect venv, poetry, uv
# Example for Go: detect go.mod version
# Example for Rust: detect cargo.toml edition

if [ -n "$CONTEXT" ]; then
  echo "$CONTEXT"
fi

exit 0
`
);

// ─── stack.config.json ────────────────────────────────────────────────────────

writeFileSync(
  join(STACK_DIR, "stack.config.json"),
  JSON.stringify(
    {
      name: stackName,
      language: "TODO",
      ecosystem: "TODO",
      docs: [
        "// TODO: Add 3-5 official doc URLs for research mode",
        "// Example: https://nextjs.org/docs/app/building-your-application/routing",
      ],
      exemplars: [
        "// TODO: Add 2-3 high-quality open-source repos as reference",
        "// Example: vercel/next.js/examples/with-prisma",
        "// Example: steven-tey/dub",
      ],
      sparsePaths: [
        "// Optional: paths to sparse-checkout for large exemplar repos",
        "// If set, only these paths are downloaded (faster). If empty/missing, full clone.",
        "// Example: src/**",
        "// Example: package.json",
        "// Example: tsconfig.json",
      ],
    },
    null,
    2
  ) + "\n"
);

// ─── CLAUDE.local.md.example ──────────────────────────────────────────────────

writeFileSync(
  join(STACK_DIR, "CLAUDE.local.md.example"),
  `# Local Overrides (rename to CLAUDE.local.md)

<!-- This file is gitignored. Use it for personal preferences and project-specific
     context that shouldn't be shared with the team. -->

## My Preferences

<!-- Examples:
- I prefer verbose explanations over terse responses
- Always suggest tests before implementation
- Use pnpm, not npm
-->

## Project Context

<!-- Examples:
- We deploy to AWS ECS via GitHub Actions
- The staging DB is shared — don't run destructive migrations without asking
- Feature flags are managed in LaunchDarkly
-->

## Local Environment Notes

<!-- Examples:
- My local DB runs on port 5433 (not default 5432)
- I use nvm with .nvmrc
- Docker desktop must be running for integration tests
-->
`
);

// ─── .gitignore ───────────────────────────────────────────────────────────────

writeFileSync(
  join(STACK_DIR, ".gitignore"),
  `# Local settings (secrets, vault paths)
settings.local.json
CLAUDE.local.md

# Memory (symlinked to Obsidian vault or local)
memory/

# Temp files
*.tmp
*.log
`
);

// ─── Done ─────────────────────────────────────────────────────────────────────

console.log(`
Scaffolded new stack: ${STACK_DIR}

Created:
  CLAUDE.md              — project instructions (fill TODO sections)
  settings.json          — permissions and hooks config
  settings.README.md     — explains how to customize settings.json
  stack.config.json      — research sources (fill for /new-stack research mode)
  CLAUDE.local.md.example — personal overrides template
  .gitignore             — excludes local/temp files
  rules/                 — 6 rule stubs (code-quality, testing, api, database, security, error-handling)
  agents/                — 4 agent stubs (code-reviewer, security, performance, doc)
  hooks/                 — 4 hook stubs (protect-files, warn-large-files, format-on-save, session-start)
  skills/                — 7 skill stubs with SKILL.md templates

Next steps:
  1. Fill stack.config.json with doc URLs and exemplar repos
  2. Run research mode to assist filling TODOs (or fill manually)
  3. Customize hooks for this stack's build tools and lockfiles
  4. Adapt skill SKILL.md files from generic-ts/nestjs as a reference
`);
