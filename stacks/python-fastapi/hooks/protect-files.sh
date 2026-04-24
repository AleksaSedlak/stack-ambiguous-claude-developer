#!/bin/bash
# Blocks edits to sensitive or generated files.
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

# Protected patterns — secrets, keys, lockfiles
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
  "uv.lock"
  "requirements.lock"
  "requirements.txt"
)

BASENAME=$(basename "$FILE_PATH")

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Protected file: $BASENAME matches pattern '$pattern'\"}}"
      exit 2
      ;;
  esac
done

# Block sensitive directories and rarely-edited config
case "$FILE_PATH" in
  .git/*|*/.git/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit files inside .git/\"}}"
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
  alembic/env.py|*/alembic/env.py)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"ask\",\"permissionDecisionReason\":\"alembic/env.py is rarely edited — confirm this change is intentional.\"}}"
    exit 2
    ;;
esac

exit 0
