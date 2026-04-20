#!/bin/bash
# Auto-formats Python files after Claude edits them.
# Used as a PostToolUse hook for Edit|Write operations.
# Never blocks — exits 0 on any failure so writes aren't interrupted.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

# Only format Python files
EXTENSION="${FILE_PATH##*.}"
case "$EXTENSION" in
  py) ;;
  *) exit 0 ;;
esac

# Prefer ruff (fast), fall back to black
if command -v ruff >/dev/null 2>&1; then
  ruff format "$FILE_PATH" 2>/dev/null
elif command -v black >/dev/null 2>&1; then
  black --quiet "$FILE_PATH" 2>/dev/null
fi

exit 0
