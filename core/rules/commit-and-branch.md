---
alwaysApply: true
description: Commit, branch, and destructive-operation rules for autonomous mode.
---

# Commit Rules

- **One logical change per commit.** A bug fix is one commit. A refactor is another. Never mix.
- **Max 300 lines per commit** excluding generated files and lockfiles. If larger, split into stacked commits.
- **Conventional Commits.** Subject ≤72 chars, imperative mood, type prefix (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`, `test:`).
- **Body explains WHY.** The diff shows what changed; the commit message explains motivation.
- **Never commit**: `.env`, lockfile changes not tied to an intentional dependency change, debug logs, commented-out code, files containing scaffold markers.
- **Never amend a pushed commit** unless the user explicitly asks.

# Branch Rules

- NEVER commit directly to `main`, `master`, `develop`, or any protected branch. Verify by checking branch protection config if unclear.
- Branch naming: `<type>/<short-kebab-description>` — e.g. `feat/user-registration`, `fix/null-avatar`, `refactor/extract-auth-service`.
- One branch per task. Do not pile unrelated changes onto the same branch.
- Push the branch after the first meaningful commit so work isn't lost locally.
- Open a PR only when: the change is complete, all pre-commit checks pass, and the diff is ready for human review.

# Destructive Operations — Always Ask First

Require explicit user confirmation BEFORE executing any of:

- Creating or modifying a database migration
- Deleting any file (not just editing it)
- `git reset --hard`, `git rebase` on shared branches, `git push --force` or `--force-with-lease`
- Modifying `.claude/settings.json` or any file in `.claude/hooks/`
- Any command with `--force`, `--hard`, or `--delete`
- Dropping, truncating, or seeding database tables
- Modifying CI/CD configuration (`.github/`, `.gitlab-ci.yml`, etc.)
- Publishing packages (`npm publish`, `mix hex.publish`, `cargo publish`)
- Regenerating lockfiles from scratch
