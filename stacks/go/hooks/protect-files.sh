#!/bin/bash
# Blocks edits to sensitive or generated files.
# Used as a PreToolUse hook for Edit|Write operations.
# Exit 2 = block the action. Exit 0 = allow.
#
# TODO: Customize PROTECTED_PATTERNS and directory blocks for go

if ! command -v jq >/dev/null 2>&1; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"jq is required for file protection hooks but is not installed.\"}}"
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

for pattern in "${PROTECTED_PATTERNS[@]}"; do
  case "$BASENAME" in
    $pattern)
      echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Protected file: $BASENAME matches pattern '$pattern'\"}}"
      exit 2
      ;;
  esac
done

# TODO: Add stack-specific directory blocks
case "$FILE_PATH" in
  .git/*|*/.git/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit files inside .git/\"}}"
    exit 2
    ;;
  .claude/hooks/*|*/.claude/hooks/*)
    echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"Cannot edit hook scripts — these enforce security boundaries.\"}}"
    exit 2
    ;;
esac

exit 0
