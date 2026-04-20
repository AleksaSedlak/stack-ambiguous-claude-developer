---
alwaysApply: true
description: Conditions under which the agent must halt and ask the user, rather than proceed with an assumption.
---

# Mandatory Stop Conditions

STOP and ask the user (do not proceed with an assumption) when:

- Requirements are ambiguous and the two most likely interpretations would produce >20 lines of different code
- Tests fail and you cannot fix them within 3 edit-run cycles
- The change requires a new database migration
- The change adds or removes a dependency from the stack's manifest (package.json, mix.exs, Cargo.toml, etc.)
- The change modifies authentication, authorization, or payment logic
- The change deletes >50 lines of code that is not obviously dead (dead = zero imports, zero references, not exported publicly)
- The change modifies a public API contract: route paths, HTTP methods, response shapes, exported function signatures, published event schemas
- You need to modify files in >5 different directories for one logical change
- The change requires environment variables that don't exist in `.env.example`
- You're unsure whether a file is dead code or used dynamically (string import, reflection, config-driven loading)
- A hook blocks an operation you believe should succeed

When stopping: state (1) what you were trying to do, (2) which condition triggered the stop, (3) the two or three options you see, (4) your recommendation.
