#!/bin/bash
# Blocks dangerous shell commands: push to main, force push, destructive operations.
# Used as a PreToolUse hook for Bash operations.
# Exit 2 = block the action. Exit 0 = allow.

# Requires jq for JSON parsing — fail closed if missing
if ! command -v jq >/dev/null 2>&1; then
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"jq is required for command protection hooks but is not installed.\"}}"
  exit 2
fi

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if [ -z "$COMMAND" ]; then
  exit 0
fi

deny() {
  echo "{\"hookSpecificOutput\":{\"hookEventName\":\"PreToolUse\",\"permissionDecision\":\"deny\",\"permissionDecisionReason\":\"$1\"}}"
  exit 2
}

# ──────────────────────────────────────────────
# Git protections
# ──────────────────────────────────────────────

if echo "$COMMAND" | grep -qE '(^|[;&|()]+[[:space:]]*)git[[:space:]]+push'; then

  # Block push to protected branches (main, master, staging, production)
  if echo "$COMMAND" | grep -qE 'git[[:space:]]+push.*(origin[[:space:]]+|:)(main|master|staging|production)\b'; then
    deny "Blocked: cannot push directly to main/master/staging/production. Use a feature branch and create a PR."
  fi

  # Block bare "git push" when on a protected branch
  if echo "$COMMAND" | grep -qE 'git[[:space:]]+push[[:space:]]*($|[;&|])'; then
    CURRENT_BRANCH=$(git branch --show-current 2>/dev/null)
    case "$CURRENT_BRANCH" in
      main|master|staging|production)
        deny "Blocked: you are on $CURRENT_BRANCH. Use a feature branch and create a PR."
        ;;
    esac
  fi

  # Block force push (allow --force-with-lease)
  if echo "$COMMAND" | grep -qE 'git[[:space:]]+push.*(-[a-zA-Z]*f|--force)([[:space:]]|$)' && ! echo "$COMMAND" | grep -q '\-\-force-with-lease'; then
    deny "Blocked: force push is not allowed. Use --force-with-lease if you need to overwrite remote."
  fi
fi

# Block git reset --hard (loses uncommitted work permanently)
if echo "$COMMAND" | grep -qE 'git[[:space:]]+reset[[:space:]]+--hard'; then
  deny "Blocked: git reset --hard discards uncommitted changes permanently. Use git stash or git reset --soft instead."
fi

# Block git clean -f (permanently deletes untracked files)
if echo "$COMMAND" | grep -qE 'git[[:space:]]+clean[[:space:]]+-[a-zA-Z]*f'; then
  deny "Blocked: git clean -f permanently deletes untracked files. Review with git clean -n first, then run manually if intended."
fi

# ──────────────────────────────────────────────
# Destructive filesystem operations
# ──────────────────────────────────────────────

# Block rm -rf on root, home, or broad paths
if echo "$COMMAND" | grep -qE 'rm[[:space:]]+-[a-zA-Z]*r[a-zA-Z]*f[[:space:]]+(\/|~|\$HOME|\.\.\/\.\.)'; then
  deny "Blocked: recursive force-delete on root/home/parent paths. Specify a safe target directory."
fi

if echo "$COMMAND" | grep -qE 'rm[[:space:]]+-[a-zA-Z]*r.*[[:space:]]+(\/[[:space:]]|\/\*|\/$|~\/?\*?[[:space:]]|~\/?\*?$)'; then
  deny "Blocked: recursive delete targeting root or home directory."
fi

# ──────────────────────────────────────────────
# Dangerous database operations
# ──────────────────────────────────────────────

# Block DROP TABLE/DATABASE without safeguards
if echo "$COMMAND" | grep -qiE 'DROP[[:space:]]+(TABLE|DATABASE|SCHEMA)[[:space:]]'; then
  deny "Blocked: DROP TABLE/DATABASE/SCHEMA detected. This is destructive and irreversible. Run manually if intended."
fi

# Block DELETE FROM without WHERE
if echo "$COMMAND" | grep -qiE 'DELETE[[:space:]]+FROM[[:space:]]+[a-zA-Z_]+[[:space:]]*($|;)' && ! echo "$COMMAND" | grep -qiE 'WHERE'; then
  deny "Blocked: DELETE FROM without WHERE clause would delete all rows. Add a WHERE clause."
fi

# Block TRUNCATE TABLE
if echo "$COMMAND" | grep -qiE 'TRUNCATE[[:space:]]+TABLE'; then
  deny "Blocked: TRUNCATE TABLE detected. This is destructive and irreversible. Run manually if intended."
fi

# ──────────────────────────────────────────────
# Dangerous system commands
# ──────────────────────────────────────────────

# Block chmod 777
if echo "$COMMAND" | grep -qE 'chmod[[:space:]]+777'; then
  deny "Blocked: chmod 777 gives everyone read/write/execute. Use more restrictive permissions (e.g., 755 or 644)."
fi

# Block piping curl/wget to shell execution
if echo "$COMMAND" | grep -qE '(curl|wget)[[:space:]].*\|[[:space:]]*(bash|sh|zsh|sudo)'; then
  deny "Blocked: piping downloaded content directly to a shell is dangerous. Download first, inspect, then execute."
fi

# Block disk/partition destructive commands
if echo "$COMMAND" | grep -qE '(mkfs|dd[[:space:]]+if=)' || (echo "$COMMAND" | grep -qE '>[[:space:]]*/dev/' && ! echo "$COMMAND" | grep -qE '>[[:space:]]*/dev/null'); then
  deny "Blocked: destructive disk operation detected. This can cause irreversible data loss."
fi

# ──────────────────────────────────────────────
# Elixir / Mix protections
# ──────────────────────────────────────────────

# Block publishing to Hex.pm
if echo "$COMMAND" | grep -qE 'mix[[:space:]]+hex\.publish'; then
  deny "Blocked: publishing Hex packages should be done manually or via CI, not through Claude Code."
fi

# Block dropping the database
if echo "$COMMAND" | grep -qE 'mix[[:space:]]+ecto\.drop'; then
  deny "Blocked: mix ecto.drop destroys the entire database. Run manually if intended."
fi

# Block running in production environment
if echo "$COMMAND" | grep -qE 'MIX_ENV=prod[[:space:]]+mix'; then
  deny "Blocked: running mix commands in MIX_ENV=prod is not allowed through Claude Code. Use CI/CD for production operations."
fi

# Block remote shell / RPC on production nodes
if echo "$COMMAND" | grep -qE '(--remsh|--rpc)[[:space:]]'; then
  deny "Blocked: remote shell and RPC connections to nodes are not allowed through Claude Code."
fi

# Block production asset pipeline (should run via CI)
if echo "$COMMAND" | grep -qE 'mix[[:space:]]+(assets\.deploy|phx\.digest)'; then
  deny "Blocked: production asset builds should be done via CI, not through Claude Code."
fi

# Block wiping all dependencies
if echo "$COMMAND" | grep -qE 'mix[[:space:]]+deps\.clean[[:space:]]+--all'; then
  deny "Blocked: mix deps.clean --all removes all dependencies. Run manually if intended."
fi

# Block unlocking all dependency versions at once
if echo "$COMMAND" | grep -qE 'mix[[:space:]]+deps\.unlock[[:space:]]+--all'; then
  deny "Blocked: mix deps.unlock --all unlocks all dependency versions at once. Unlock specific packages instead."
fi

exit 0
