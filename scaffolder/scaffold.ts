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

const RULE_HEADER = `<!-- Fill each section below. Replace the <!-- EXAMPLE --> blocks with real
     stack-specific rules. Do not leave any <!-- EXAMPLE --> blocks in a finished
     stack — validate-stack.ts will fail. -->`;

interface RuleStub {
  name: string;
  description: string;
  alwaysApply: boolean;
  paths: string[];
  content: string;
}

const ruleStubs: RuleStub[] = [
  {
    name: "code-quality",
    description: `Code quality patterns for ${stackName}`,
    alwaysApply: true,
    paths: [],
    content: `${RULE_HEADER}

## Principles

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write functions that do multiple things separated by blank lines or section comments.
**Do:** Extract each responsibility into a named function. If you can't name it without "and", split it.
**Why:** Small functions are testable, reusable, and readable. Large functions hide bugs in their middle.
<!-- /EXAMPLE -->

## Language/Type Safety

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use \`any\` or equivalent to silence a type error.
**Do:** Use the language's narrowing/pattern-matching to handle all cases explicitly.
**Why:** Type erasure at runtime means the compiler is your only safety net — bypassing it invites production crashes.
<!-- /EXAMPLE -->

## Naming

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use abbreviations like \`usr\`, \`btn\`, \`mgr\`, \`svc\` in identifiers.
**Do:** Use full words: \`user\`, \`button\`, \`manager\`, \`service\`. Only abbreviate universally known terms (\`id\`, \`url\`, \`api\`, \`db\`).
**Why:** Code is read 10x more than written. Saving 3 characters costs every future reader a mental lookup.
<!-- /EXAMPLE -->

## Patterns

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use sequential awaits on independent async operations.
**Do:** Use concurrent execution (Promise.all, Task.async_stream, goroutines) for independent work.
**Why:** Sequential awaits double/triple latency for no reason when operations don't depend on each other.
<!-- /EXAMPLE -->

## Comments

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write comments that restate what the code does (\`// increment counter\`).
**Do:** Comment WHY — non-obvious decisions, workarounds with issue links, algorithm rationale.
**Why:** The code already says what. Comments that restate it become lies when the code changes.
<!-- /EXAMPLE -->`,
  },
  {
    name: "testing",
    description: `Testing patterns for ${stackName}`,
    alwaysApply: true,
    paths: [],
    content: `${RULE_HEADER}

## Principles

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Write tests that assert implementation details (mock call counts, internal state).
**Do:** Assert observable behavior — given this input, expect this output or side effect.
**Why:** Implementation-coupled tests break on every refactor without catching real bugs.
<!-- /EXAMPLE -->

## Naming

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Name tests \`it('should work')\` or \`it('works correctly')\`.
**Do:** Name tests as behavior sentences: \`it('returns 404 when user does not exist')\`.
**Why:** When a test fails in CI, the name is all you see. It must tell you what broke without reading the code.
<!-- /EXAMPLE -->

## Structure

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Mix setup, action, and assertions throughout the test body.
**Do:** Use Arrange-Act-Assert: clear setup block, single action, then assertions.
**Why:** AAA structure makes tests scannable — you can instantly see what's being tested and what's expected.
<!-- /EXAMPLE -->

## Mocking

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Mock the module under test, or deep-mock collaborators with complex return setups.
**Do:** Mock only at system boundaries (HTTP, DB driver, filesystem, clock). Use real implementations for everything else.
**Why:** Over-mocking creates tests that pass with broken code. Boundary mocks catch real integration issues.
<!-- /EXAMPLE -->

## Coverage

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Target 100% line coverage with synthetic assertions that don't verify behavior.
**Do:** Cover happy path, error paths, and edge cases for each public function. Coverage is a symptom of good tests, not a goal.
**Why:** A test that hits a line without asserting its behavior is a false signal — it gives confidence without evidence.
<!-- /EXAMPLE -->`,
  },
  {
    name: "api",
    description: `API/handler patterns for ${stackName}`,
    alwaysApply: false,
    paths: ["src/controllers/**", "src/routes/**", "app/api/**", "src/handlers/**"],
    content: `${RULE_HEADER}

## Request Handling

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Put business logic directly in route handlers / controllers.
**Do:** Keep handlers thin — parse input, call a service, format output. Logic lives in services.
**Why:** Thin handlers are testable without HTTP, reusable across transports, and easy to review.
<!-- /EXAMPLE -->

## Input Validation

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Trust request body shapes because your types say so — types are erased at runtime.
**Do:** Validate every input with a runtime schema (Zod, class-validator, Pydantic, etc.) at the handler boundary.
**Why:** Unvalidated input is the #1 source of injection, crashes, and data corruption.
<!-- /EXAMPLE -->

## Response Formatting

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Return raw database entities as API responses.
**Do:** Define response DTOs/shapes that expose only what clients need. Never leak internal fields (password hashes, internal IDs, audit timestamps).
**Why:** Coupling responses to DB schema means every schema change is a breaking API change.
<!-- /EXAMPLE -->

## Error Responses

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Return stack traces, SQL fragments, or internal file paths in error responses.
**Do:** Map errors to a consistent shape (\`{ code, message }\`) in one place (error middleware / exception filter).
**Why:** Verbose errors are an information leak to attackers and useless to API consumers.
<!-- /EXAMPLE -->`,
  },
  {
    name: "database",
    description: `Database access patterns for ${stackName}`,
    alwaysApply: false,
    paths: ["src/repositories/**", "src/models/**", "prisma/**", "migrations/**", "src/db/**"],
    content: `${RULE_HEADER}

## Migrations

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Modify an existing migration that has been applied to any environment.
**Do:** Always create a new migration for schema changes. Treat applied migrations as immutable history.
**Why:** Modifying a migration that's been run elsewhere causes schema drift — staging and production diverge silently.
<!-- /EXAMPLE -->

## Query Patterns

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Call the database inside a loop (\`for user in users: db.get_orders(user.id)\`).
**Do:** Batch queries (\`WHERE id IN (...)\`) or use eager loading / joins / includes.
**Why:** N+1 queries are the most common performance bug in data-backed apps. 100 users = 101 queries instead of 2.
<!-- /EXAMPLE -->

## Transactions

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Do HTTP calls or slow I/O inside an open transaction.
**Do:** Keep transactions short — gather data outside, then wrap only the writes in a transaction.
**Why:** Long-held transactions starve the connection pool and can cause deadlocks under concurrent load.
<!-- /EXAMPLE -->

## Connection Pooling

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Open unbounded concurrent database calls (\`Promise.all(thousands.map(query))\`).
**Do:** Use bounded concurrency (pool size limits, p-limit, semaphores) matching your connection pool.
**Why:** Exceeding pool size causes connection timeouts that cascade into request failures.
<!-- /EXAMPLE -->`,
  },
  {
    name: "security",
    description: `Security patterns for ${stackName}`,
    alwaysApply: false,
    paths: ["src/**"],
    content: `${RULE_HEADER}

## Input Validation

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Trust client-provided data without runtime validation — types don't exist at runtime.
**Do:** Parse and validate at every system boundary with a schema library. Reject unknown fields by default.
**Why:** Unvalidated input is the entry point for injection, overflow, and logic bugs.
<!-- /EXAMPLE -->

## Injection Prevention

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Build SQL, shell commands, or templates with string concatenation using user input.
**Do:** Use parameterized queries, argv arrays for shell, and auto-escaping template engines.
**Why:** Injection is the most exploited vulnerability class. One unescaped input = full compromise.
<!-- /EXAMPLE -->

## Authentication

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Roll your own OAuth flow, JWT validation, or session management from scratch.
**Do:** Use established libraries (Passport, Auth.js, Lucia, better-auth, python-jose, etc.). Store tokens in httpOnly cookies.
**Why:** Hand-rolled auth has subtle timing, storage, and validation bugs that libraries have already fixed.
<!-- /EXAMPLE -->

## Authorization

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Fetch a resource by ID without checking ownership or role (\`db.findById(req.params.id)\`).
**Do:** Always scope queries by the authenticated principal or check access explicitly before returning data.
**Why:** IDOR (Insecure Direct Object Reference) is the most common authorization flaw — knowing an ID shouldn't grant access.
<!-- /EXAMPLE -->

## Secrets

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Scatter \`process.env.SECRET\` / \`os.environ["SECRET"]\` calls throughout the codebase.
**Do:** Load all secrets through a single typed config module. Validate at startup. Fail fast on missing secrets.
**Why:** Centralized config makes secrets auditable, testable (mock one module), and impossible to accidentally log.
<!-- /EXAMPLE -->

## Dependencies

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Install packages without checking maintenance status or known vulnerabilities.
**Do:** Run \`audit\` in CI, pin security-critical packages, and review new deps before adding.
**Why:** Supply chain attacks target unmaintained packages. One compromised transitive dep = full access.
<!-- /EXAMPLE -->`,
  },
  {
    name: "error-handling",
    description: `Error handling patterns for ${stackName}`,
    alwaysApply: false,
    paths: ["src/**"],
    content: `${RULE_HEADER}

## Error Classes

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Throw bare strings, numbers, or plain objects as errors.
**Do:** Define typed error classes with stable codes. Extend from the language's base Error class.
**Why:** Typed errors enable pattern matching in catch blocks and structured logging. Bare strings lose stack traces.
<!-- /EXAMPLE -->

## Async Error Flow

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Leave async calls unhandled (floating promises, unawaited tasks, fire-and-forget).
**Do:** Every async operation is either awaited, returned, or explicitly caught with error handling.
**Why:** Unhandled rejections crash the process in modern runtimes. Silent failures corrupt state.
<!-- /EXAMPLE -->

## HTTP Boundaries

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Let handlers individually format error responses with inconsistent shapes.
**Do:** Map your error taxonomy to HTTP status codes in ONE place (error middleware / exception filter / error boundary).
**Why:** Consistent error responses make APIs predictable for consumers and logs parseable for operators.
<!-- /EXAMPLE -->

## Logging

<!-- EXAMPLE — replace with stack-specific content -->
**Don't:** Use print/console.log for production error logging. Don't log full request bodies or user objects.
**Do:** Use structured logging (JSON) with named event strings, correlation IDs, and a redact list for sensitive fields.
**Why:** Unstructured logs are unsearchable. Logging secrets or PII violates compliance and creates breach risk.
<!-- /EXAMPLE -->`,
  },
];

for (const rule of ruleStubs) {
  const pathsBlock = rule.paths.length > 0
    ? rule.paths.map((p) => `  - "${p}"`).join("\n")
    : `  - "**/*.TODO_ADD_GLOB"`;

  writeFileSync(
    join(STACK_DIR, "rules", `${rule.name}.md`),
    `---
description: ${rule.description}
alwaysApply: ${rule.alwaysApply}${!rule.alwaysApply ? `\npaths:\n${pathsBlock}` : ""}
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
