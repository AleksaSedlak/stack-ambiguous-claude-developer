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
  - Secrets: `.env*`, `*.pem`, `*.key`, `credentials.json`, `*.p12`, `*.pfx`
  - Build output: `dist/`, `build/`, `.next/`, `.nuxt/`, `.output/`, `.svelte-kit/`, `.turbo/`, `.cache/`, `coverage/`, `.parcel-cache/`
  - Dependencies: `node_modules/`
  - OS/editor: `.DS_Store`, `Thumbs.db`, `*.swp`, `.idea/`, `.vscode/settings.json`
  - Lockfiles: only stage `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lockb` if the dependency change is intentional
- Draft a commit message based on the changes, matching the repo's existing commit style. If the repo uses Conventional Commits (`feat:`, `fix:`, `chore:`, `refactor:`, `docs:`, `test:`, `build:`, `ci:`), follow that format.
- **ASK the user to confirm or edit**: show the exact files to stage and the proposed commit message
- Only after confirmation: stage the files and create the commit
- If the commit fails (e.g., Husky pre-commit hook, lint-staged, Biome check), fix the issue and try again with a NEW commit — never `--amend` unless the user explicitly asks for it

## Step 3: Push

- Check if the current branch has an upstream remote
- If not, propose creating one with `git push -u origin <branch>`
- **ASK the user to confirm** before pushing
- Only after confirmation: push to remote

## Step 4: Pull Request

- Analyze ALL commits on this branch vs the base branch: `git log main..HEAD --oneline` (or `master` — detect via `git symbolic-ref refs/remotes/origin/HEAD`)
- Draft a PR title (under 72 chars) and body with:
  - Summary: 2-4 bullet points
  - Test plan: how to verify (include specific commands — e.g. `pnpm test src/modules/auth`, `pnpm dev` and navigate to /foo)
- **ASK the user to confirm or edit** the title and body
- Extract the remote URL: `git remote get-url origin`
- Convert to a browser-friendly PR creation URL:
  - SSH format `git@github.com:org/repo.git` → `https://github.com/org/repo/compare/<branch>?expand=1`
  - HTTPS format `https://github.com/org/repo.git` → `https://github.com/org/repo/compare/<branch>?expand=1`
  - GitLab `git@gitlab.com:group/repo.git` → `https://gitlab.com/group/repo/-/merge_requests/new?merge_request[source_branch]=<branch>`
  - Bitbucket `git@bitbucket.org:workspace/repo.git` → `https://bitbucket.org/workspace/repo/pull-requests/new?source=<branch>`
- Present to the user:
  > Branch pushed. Create your PR here: `<url>`
  >
  > **Suggested title**: <title>
  >
  > **Suggested body**:
  > <body>

## Rules

- NEVER skip a confirmation step — each step requires explicit user approval
- NEVER force-push (use `--force-with-lease` only if the user explicitly asks)
- NEVER commit `.env`, secrets, or credential files
- NEVER run `npm publish` / `pnpm publish` / `yarn publish` / `bun publish` as part of ship — publishing is a separate, deliberate action
- If the user says "skip" at any step, skip that step and move to the next
- If $ARGUMENTS is provided, use it as the commit message / PR title
