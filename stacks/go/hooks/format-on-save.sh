#!/bin/bash
# Auto-formats files after Claude edits them.
# Used as a PostToolUse hook for Edit|Write operations.
# Never blocks — exits 0 on any failure so writes aren't interrupted.
#
# TODO: Customize for go's formatter

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
