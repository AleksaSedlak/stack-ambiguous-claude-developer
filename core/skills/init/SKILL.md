---
name: init
description: Bootstrap a new project from scratch — scaffold, configure .claude/, and make the initial commit
argument-hint: "[project type: api, web-app, cli, library]"
disable-model-invocation: true
---

Bootstrap a new project in the current directory.

## Step 1: Understand What to Build

Ask the user (if not provided in $ARGUMENTS):

1. **What kind of project?** — API, web app, CLI tool, library, or other
2. **Framework preference?** — or use the stack default
3. **Any specific requirements?** — database, auth, specific libraries

## Step 2: Scaffold the Project

Use the stack's official scaffolder or recommended starter:
- The exact command depends on the stack (e.g., `create-next-app`, `fastapi-cli`, `mix phx.new`, `cargo init`)
- Check CLAUDE.md for the stack's recommended scaffold command
- **ASK the user to confirm** the scaffold command before running

If the stack has no official scaffolder, create the minimal project structure manually:
- Entry point file
- Config files (package.json / pyproject.toml / mix.exs / Cargo.toml)
- Source directory
- Test directory
- .gitignore

## Step 3: Initialize Git

- `git init` (if not already a git repo)
- Create `.gitignore` appropriate for the stack (if the scaffolder didn't)
- Stage all scaffolded files
- Create initial commit: `chore: scaffold <project-type> project`

## Step 4: Configure Claude

Run `/setupdotclaude` to configure the `.claude/` directory for this project. If the project is empty/new, setupdotclaude will apply best-practice defaults for the stack.

## Step 5: Summary

```
Project initialized:
- Type: <project-type>
- Framework: <framework>
- Location: <path>
- .claude/ configured with <stack> defaults

Next steps:
- Review CLAUDE.md and adjust to your preferences
- Start building: describe what you want to create
```

## Rules

- NEVER skip the user confirmation before running the scaffolder
- NEVER install dependencies without asking (the scaffolder usually does this)
- If the directory is not empty, warn the user before proceeding
- Keep it minimal — scaffold and configure, don't build features
