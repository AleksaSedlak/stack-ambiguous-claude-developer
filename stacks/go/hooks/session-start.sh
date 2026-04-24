#!/bin/bash
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
