---
name: setupdotclaude
description: Scan the project and customize .claude/ configuration to match the actual go stack
argument-hint: "[optional: focus area like 'frontend' or 'backend']"
disable-model-invocation: true
---

<!-- TODO: Write the full setupdotclaude skill for go.
     This skill is 100% stack-specific — it detects the project's tools, frameworks,
     and structure, then customizes .claude/ files accordingly.

     See stacks/generic-ts/skills/setupdotclaude/SKILL.md or
     stacks/nestjs/skills/setupdotclaude/SKILL.md for complete examples.

     Key phases to implement:
     1. Detect tech stack (package manager, framework, test runner, linter, ORM)
     2. Present findings to user for confirmation
     3. Customize each .claude/ file based on detection
     4. Generate workflow-commands.json
     5. Summary of changes -->
