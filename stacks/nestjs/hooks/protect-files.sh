#!/bin/bash
# Blocks edits to sensitive or generated files in a TS/JS project.
# Used as a PreToolUse hook for Edit|Write operations.
# Exit 2 = block the action. Exit 0 = allow.

# Requires jq for JSON parsing — fail closed if missing
if ! command -v jq >/dev/null 2>&1; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"jq is required for file protection hooks but is not installed.\"}}"
  exit 2
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Protected basename patterns
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
  "package-lock.json"
  "pnpm-lock.yaml"
  "yarn.lock"
  "bun.lockb"
)

BASENAME=$(basename "$FILE_PATH")

# Explicit allowlist — safe env files that are MEANT to be committed.
# Checked before deny patterns so `.env.example` etc. don't match `.env.*`.
ALLOWED_ENV_FILES=(
  ".env.example"
  ".env.sample"
  ".env.template"
  ".env.defaults"
  ".env.dist"
)

for allowed in "${ALLOWED_ENV_FILES[@]}"; do
  if [ "$BASENAME" = "$allowed" ]; then
    exit 0
  fi
done

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      case "$pattern" in
        package-lock.json|pnpm-lock.yaml|yarn.lock|bun.lockb)
          echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Lockfile '$BASENAME' is managed by your package manager. Run install/add commands to update it — do not hand-edit.\"}}"
          ;;
        *)
          echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Protected file: $BASENAME matches pattern '$pattern'\"}}"
          ;;
      esac
      exit 2
      ;;
  esac
done

# Block anything in common sensitive or generated directories
case "$FILE_PATH" in
  .git/*|*/.git/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit files inside .git/\"}}"
    exit 2
    ;;
  secrets/*|*/secrets/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit files inside secrets/\"}}"
    exit 2
    ;;
  node_modules/*|*/node_modules/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit files inside node_modules/ — these are managed by your package manager.\"}}"
    exit 2
    ;;
  .env|.env.*|*/.env|*/.env.*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit .env files. Update .env.example if a new variable is needed.\"}}"
    exit 2
    ;;
  .claude/hooks/*|*/.claude/hooks/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit hook scripts — these enforce security boundaries.\"}}"
    exit 2
    ;;
  .claude/settings.json|*/.claude/settings.json)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"ask\",\"permissionDecisionReason\":\"Editing settings.json — this controls permissions and hooks. Confirm this change.\"}}"
    exit 2
    ;;
esac

exit 0
