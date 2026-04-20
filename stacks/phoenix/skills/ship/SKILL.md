---
name: ship
description: Scan changes, commit, push, and prepare a PR — with confirmation at each step
argument-hint: "[optional commit message or PR title]"
disable-model-invocation: true
allowed-tools:
  - Bash(git status)
  - Bash(git diff *)
  - Bash(git log *)
  - Bash(git add *)
  - Bash(git commit *)
  - Bash(git push *)
  - Bash(git checkout *)
  - Bash(git branch *)
  - Bash(git remote *)
---

Ship the current changes through commit, push, and PR creation. Confirm with the user before each step using the AskUserQuestion tool.

## Step 1: Scan

- Run `git status` to see all changed, staged, and untracked files
- Run `git diff` to see what changed (staged + unstaged)
- Run `git log --oneline -5` to see recent commit style
- Present a clear summary to the user:
  - Files modified
  - Files added
  - Files deleted
  - Untracked files
- If there are no changes, tell the user and stop

## Step 2: Stage & Commit

- Propose which files to stage. **Never stage** these:
  - Secrets: `.env*`, `*.pem`, `*.key`, `credentials.json`
  - Build output: `_build/`, `priv/static/`
  - Dependencies: `deps/`
  - OS/editor: `.DS_Store`, `Thumbs.db`, `*.swp`, `.idea/`, `.vscode/settings.json`
- Draft a commit message based on the changes, matching the repo's existing commit style
- **ASK the user to confirm or edit**: show the exact files to stage and the proposed commit message
- Only after confirmation: stage the files and create the commit
- If the commit fails (e.g., pre-commit hook), fix the issue and try again with a NEW commit

## Step 3: Push

- Check if the current branch has an upstream remote
- If not, propose creating one with `git push -u origin <branch>`
- **ASK the user to confirm** before pushing
- Only after confirmation: push to remote

## Step 4: Pull Request

- Analyze ALL commits on this branch vs the base branch: `git log main..HEAD --oneline`
- Draft a PR title (under 72 chars) and body with:
  - Summary: 2-4 bullet points
  - Test plan: how to verify
- **ASK the user to confirm or edit** the title and body
- Extract the remote URL: `git remote get-url origin`
- Convert to a browser-friendly PR creation URL:
  - SSH format `git@github.com:org/repo.git` → `https://github.com/org/repo/compare/<branch>?expand=1`
  - HTTPS format `https://github.com/org/repo.git` → `https://github.com/org/repo/compare/<branch>?expand=1`
- Present to the user:
  > Branch pushed. Create your PR here: `<url>`
  >
  > **Suggested title**: <title>
  >
  > **Suggested body**:
  > <body>

## Rules

- NEVER skip a confirmation step — each step requires explicit user approval
- NEVER force-push
- NEVER commit .env, secrets, or credential files
- If the user says "skip" at any step, skip that step and move to the next
- If $ARGUMENTS is provided, use it as the commit message / PR title
