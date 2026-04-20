#!/bin/bash
# Injects dynamic project context at session start.
# Used as a SessionStart hook.

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

# Python version
PYTHON_VERSION=$(python3 --version 2>/dev/null || python --version 2>/dev/null)
if [ -n "$PYTHON_VERSION" ]; then
  CONTEXT="$CONTEXT | $PYTHON_VERSION"
fi

# Virtual environment detection
if [ -n "$VIRTUAL_ENV" ]; then
  VENV_NAME=$(basename "$VIRTUAL_ENV")
  CONTEXT="$CONTEXT | venv: $VENV_NAME (active)"
elif [ -d ".venv" ]; then
  CONTEXT="$CONTEXT | venv: .venv (inactive)"
elif [ -d "venv" ]; then
  CONTEXT="$CONTEXT | venv: venv (inactive)"
fi

# Package manager detection
if [ -f "uv.lock" ]; then
  CONTEXT="$CONTEXT | pkg: uv"
elif [ -f "poetry.lock" ]; then
  CONTEXT="$CONTEXT | pkg: poetry"
elif [ -f "Pipfile.lock" ]; then
  CONTEXT="$CONTEXT | pkg: pipenv"
elif [ -f "requirements.txt" ]; then
  CONTEXT="$CONTEXT | pkg: pip"
fi

if [ -n "$CONTEXT" ]; then
  echo "$CONTEXT"
fi

exit 0
