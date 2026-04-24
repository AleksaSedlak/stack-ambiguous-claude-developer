# settings.json — Customization Guide

## permissions.allow

Add safe, read-only, and dev commands for this stack. Examples:

- Node: `Bash(npm test*)`, `Bash(npx tsc*)`, `Bash(npx vitest*)`
- Python: `Bash(pytest*)`, `Bash(ruff*)`, `Bash(mypy*)`
- Go: `Bash(go test*)`, `Bash(go build*)`, `Bash(golangci-lint*)`
- Elixir: `Bash(mix test*)`, `Bash(mix compile*)`, `Bash(mix format*)`

## permissions.deny

Add files and directories that should never be edited. Examples:

- Lockfiles: `Edit(package-lock.json)`, `Edit(pnpm-lock.yaml)`
- Build output: `Edit(dist/**)`, `Write(dist/**)`
- Dependencies: `Edit(node_modules/**)`, `Write(vendor/**)`

## hooks

The hook configuration is pre-wired. Customize the hook SCRIPTS in `hooks/`,
not the hook wiring here (unless adding new hook triggers).
