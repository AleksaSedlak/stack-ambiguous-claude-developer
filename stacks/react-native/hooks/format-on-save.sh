#!/bin/bash
# Auto-formats TS/JS files after Claude edits them.
# Used as a PostToolUse hook for Edit|Write operations.
# Runs the best available formatter — Biome, Prettier, or ESLint --fix — based on what the project has configured.
# Never blocks — exits 0 on any failure so writes aren't interrupted.

if ! command -v jq >/dev/null 2>&1; then
  exit 0
fi

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ] || [ ! -f "$FILE_PATH" ]; then
  exit 0
fi

EXTENSION="${FILE_PATH##*.}"

# Only format source files
case "$EXTENSION" in
  ts|tsx|js|jsx|mjs|cjs|mts|cts|json|md|mdx|css|scss|html|vue|svelte|astro) ;;
  *) exit 0 ;;
esac

# Find the project root (nearest directory with package.json)
find_project_root() {
  local dir="$PWD"
  while [ "$dir" != "/" ]; do
    if [ -f "$dir/package.json" ]; then
      echo "$dir"
      return
    fi
    dir=$(dirname "$dir")
  done
  echo "$PWD"
}

ROOT=$(find_project_root)
cd "$ROOT" 2>/dev/null || exit 0

# Prefer Biome if configured (handles both format + lint)
if [ -f "$ROOT/biome.json" ] || [ -f "$ROOT/biome.jsonc" ]; then
  if [ -x "$ROOT/node_modules/.bin/biome" ]; then
    "$ROOT/node_modules/.bin/biome" check --write "$FILE_PATH" 2>/dev/null
  elif command -v biome >/dev/null 2>&1; then
    biome check --write "$FILE_PATH" 2>/dev/null
  fi
  exit 0
fi

# Otherwise Prettier if configured
if [ -f "$ROOT/.prettierrc" ] || [ -f "$ROOT/.prettierrc.json" ] || [ -f "$ROOT/.prettierrc.js" ] || \
   [ -f "$ROOT/.prettierrc.cjs" ] || [ -f "$ROOT/.prettierrc.mjs" ] || [ -f "$ROOT/.prettierrc.yaml" ] || \
   [ -f "$ROOT/.prettierrc.yml" ] || [ -f "$ROOT/prettier.config.js" ] || [ -f "$ROOT/prettier.config.cjs" ] || \
   [ -f "$ROOT/prettier.config.mjs" ] || grep -q '"prettier"' "$ROOT/package.json" 2>/dev/null; then
  if [ -x "$ROOT/node_modules/.bin/prettier" ]; then
    "$ROOT/node_modules/.bin/prettier" --write "$FILE_PATH" 2>/dev/null
  elif command -v prettier >/dev/null 2>&1; then
    prettier --write "$FILE_PATH" 2>/dev/null
  fi
fi

# ESLint --fix as an additional pass if configured (Prettier handles formatting; ESLint handles lint fixes)
if [ -f "$ROOT/eslint.config.js" ] || [ -f "$ROOT/eslint.config.mjs" ] || [ -f "$ROOT/eslint.config.cjs" ] || \
   [ -f "$ROOT/eslint.config.ts" ] || [ -f "$ROOT/.eslintrc" ] || [ -f "$ROOT/.eslintrc.json" ] || \
   [ -f "$ROOT/.eslintrc.js" ] || [ -f "$ROOT/.eslintrc.cjs" ] || [ -f "$ROOT/.eslintrc.yaml" ] || \
   [ -f "$ROOT/.eslintrc.yml" ]; then
  # Only run ESLint --fix on code files (not json/md/css)
  case "$EXTENSION" in
    ts|tsx|js|jsx|mjs|cjs|mts|cts|vue|svelte|astro)
      if [ -x "$ROOT/node_modules/.bin/eslint" ]; then
        "$ROOT/node_modules/.bin/eslint" --fix "$FILE_PATH" 2>/dev/null
      elif command -v eslint >/dev/null 2>&1; then
        eslint --fix "$FILE_PATH" 2>/dev/null
      fi
      ;;
  esac
fi

exit 0
