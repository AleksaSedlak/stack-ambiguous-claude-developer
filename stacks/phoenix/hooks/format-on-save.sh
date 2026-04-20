#!/bin/bash
# Auto-formats Elixir files after Claude edits them.
# Used as a PostToolUse hook for Edit|Write operations.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

case "$EXTENSION" in
  ex|exs) ;;
  *) exit 0 ;;
esac

# Find the project root (nearest directory with mix.exs)
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/mix.exs" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)

if command -v mix >/dev/null 2>&1 && [ -f "$ROOT/.formatter.exs" ]; then
  (cd "$ROOT" && mix format "$FILE_PATH" 2>/dev/null)
fi

exit 0
