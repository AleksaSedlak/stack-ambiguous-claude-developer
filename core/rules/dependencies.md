---
alwaysApply: true
description: When dependency changes are allowed without asking, and when they require confirmation.
---

# Dependency Changes

## Adding a dependency — always ask

Before adding any runtime or dev dependency:

1. State the package name, what it does, weekly downloads, and last publish date
2. State why you can't solve this without the dependency, or why the dep is significantly better than a hand-rolled solution
3. Confirm the project doesn't already have a package providing the same functionality

Wait for confirmation. Do not add the dependency first and ask for forgiveness.

## Upgrading

- **Patch versions within existing range**: allowed without asking
- **Minor versions**: allowed without asking ONLY if the package's semver is trustworthy (well-known libraries with stable changelogs)
- **Major versions**: ALWAYS ask. Breaking changes are the default in major bumps.
- **Any upgrade that changes the lockfile for packages you did not intend to touch**: revert and investigate before committing.

## Removing a dependency

- Allowed without asking ONLY after confirming zero import sites remain (grep the full codebase for the package name, check for string imports and dynamic requires).
- If removal changes bundle size or runtime behavior of other packages (transitive removal), ask.
