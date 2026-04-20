#!/bin/bash
# Injects dynamic project context at session start for a TS/JS project.
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

# Staged changes indicator
if ! git diff --cached --quiet 2>/dev/null; then
  CONTEXT="$CONTEXT | Staged: yes"
fi

# Stash count
STASH_COUNT=$(git stash list 2>/dev/null | wc -l | tr -d ' ')
if [ "$STASH_COUNT" -gt 0 ] 2>/dev/null; then
  CONTEXT="$CONTEXT | Stashes: $STASH_COUNT"
fi

# Node version (if .nvmrc or engines are set)
if [ -f ".nvmrc" ]; then
  NVMRC=$(head -n1 .nvmrc 2>/dev/null | tr -d ' \n\r')
  if [ -n "$NVMRC" ]; then
    CONTEXT="$CONTEXT | Node: .nvmrc=$NVMRC"
  fi
fi

# Detect package manager from lockfile
PM=""
if [ -f "pnpm-lock.yaml" ]; then PM="pnpm"; fi
if [ -z "$PM" ] && [ -f "bun.lockb" ]; then PM="bun"; fi
if [ -z "$PM" ] && [ -f "yarn.lock" ]; then PM="yarn"; fi
if [ -z "$PM" ] && [ -f "package-lock.json" ]; then PM="npm"; fi
if [ -n "$PM" ]; then
  CONTEXT="$CONTEXT | PM: $PM"
fi

if [ -n "$CONTEXT" ]; then
  echo "$CONTEXT"
fi

# ──────────────────────────────────────────────────────────
# Obsidian auto-read (optional)
# ──────────────────────────────────────────────────────────
# If .claude/settings.local.json has obsidianVaultPath set, read the top N
# most recently modified notes from <vault>/Claude/<project>/ and inject
# their contents. N is controlled by obsidianAutoReadLimit (default 3).
#
# Requires jq for JSON parsing. If jq is missing, this block is a no-op.
#
# This is intentionally quiet on all failure modes — a broken vault path
# must not kill the session.

SETTINGS_FILE=".claude/settings.local.json"
if [ -f "$SETTINGS_FILE" ] && command -v jq >/dev/null 2>&1; then
  VAULT=$(jq -r '.obsidianVaultPath // empty' "$SETTINGS_FILE" 2>/dev/null)
  LIMIT=$(jq -r '.obsidianAutoReadLimit // 3' "$SETTINGS_FILE" 2>/dev/null)

  if [ -n "$VAULT" ] && [ -d "$VAULT" ]; then
    PROJECT_NAME=$(basename "$PWD")
    NOTES_DIR="$VAULT/Claude/$PROJECT_NAME"

    if [ -d "$NOTES_DIR" ]; then
      # Find .md files, sorted by modification time (newest first), top N.
      # Use null-delimited output to survive spaces in filenames.
      MAPFILE=$(find "$NOTES_DIR" -maxdepth 3 -type f -name '*.md' \
        -printf '%T@ %p\n' 2>/dev/null | sort -rn | head -n "$LIMIT" | cut -d' ' -f2-)

      if [ -n "$MAPFILE" ]; then
        echo ""
        echo "## Obsidian vault notes (top $LIMIT, most recent)"
        while IFS= read -r NOTE; do
          [ -z "$NOTE" ] && continue
          # Print a heading with the filename relative to the notes dir
          REL=${NOTE#"$NOTES_DIR/"}
          echo ""
          echo "### $REL"
          # Cap each note at 200 lines so a huge doc can't drown context
          head -n 200 "$NOTE" 2>/dev/null
        done <<< "$MAPFILE"
      fi
    fi
  fi
fi

exit 0
