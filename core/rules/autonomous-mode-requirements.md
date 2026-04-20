---
alwaysApply: true
description: Conditions that must be true for the agent to operate in autonomous (prompt-to-commit) mode.
---

# Autonomous Mode — Required Hook Coverage

For autonomous prompt-to-commit to be safe, these hooks MUST be active:

| Hook | Trigger | What it catches |
|------|---------|-----------------|
| protect-files.sh | PreToolUse (Edit/Write) | Edits to `.env`, secrets, lockfiles, hooks themselves |
| warn-large-files.sh | PreToolUse (Edit/Write) | Writes to build output, `node_modules`, binaries |
| scan-secrets.sh | PreToolUse (Edit/Write) | API keys, tokens, credentials in content being written |
| block-dangerous-commands.sh | PreToolUse (Bash) | Force push, `reset --hard`, push to main, `npm publish`, `DROP TABLE` |
| format-on-save.sh | PostToolUse (Edit/Write) | Consistent formatting without agent effort |

At session start, verify each hook is present and executable. If any is missing or disabled, the agent MUST NOT proceed in autonomous mode — degrade to "propose and wait" for every edit.

# Autonomous Mode Definition

Autonomous mode = agent commits without the user reviewing each change before commit.

The agent operates in autonomous mode ONLY when:

1. All required hooks are active (verified at session start)
2. The task is scoped to a feature branch, not `main`/`master`
3. The user has either explicitly enabled it for this session OR the prompt contains a clear "prompt-to-commit" intent (e.g., "implement X and commit", "ship a fix for Y")
4. No stop condition from `stop-conditions.md` has been triggered

Otherwise: default to "propose edit → apply → show diff → wait" for each significant change.
