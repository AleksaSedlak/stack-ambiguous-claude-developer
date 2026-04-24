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

# Node.js version
if command -v node >/dev/null 2>&1; then
  NODE_VERSION=$(node --version 2>/dev/null)
  CONTEXT="$CONTEXT | Node: $NODE_VERSION"
fi

# Package manager detection (check lockfiles)
if [ -f "pnpm-lock.yaml" ]; then
  PKG_MGR="pnpm"
  if command -v pnpm >/dev/null 2>&1; then
    PKG_MGR="pnpm $(pnpm --version 2>/dev/null)"
  fi
elif [ -f "yarn.lock" ]; then
  PKG_MGR="yarn"
  if command -v yarn >/dev/null 2>&1; then
    PKG_MGR="yarn $(yarn --version 2>/dev/null)"
  fi
elif [ -f "package-lock.json" ]; then
  PKG_MGR="npm"
  if command -v npm >/dev/null 2>&1; then
    PKG_MGR="npm $(npm --version 2>/dev/null)"
  fi
else
  PKG_MGR="unknown (no lockfile found)"
fi
CONTEXT="$CONTEXT | Package manager: $PKG_MGR"

# NestJS detection and version
if [ -f "package.json" ]; then
  if command -v jq >/dev/null 2>&1; then
    NEST_VERSION=$(jq -r '.dependencies["@nestjs/core"] // .devDependencies["@nestjs/core"] // empty' package.json 2>/dev/null)
    if [ -n "$NEST_VERSION" ]; then
      CONTEXT="$CONTEXT | NestJS: $NEST_VERSION"
    else
      CONTEXT="$CONTEXT | WARNING: @nestjs/core not found in package.json"
    fi
  elif grep -q '"@nestjs/core"' package.json 2>/dev/null; then
    CONTEXT="$CONTEXT | NestJS: detected (install jq for version info)"
  else
    CONTEXT="$CONTEXT | WARNING: @nestjs/core not found in package.json"
  fi
fi

if [ -n "$CONTEXT" ]; then
  echo "$CONTEXT"
fi

exit 0
