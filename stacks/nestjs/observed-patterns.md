# Observed Patterns

Auto-generated from sampling real code in this repo. `scripts/detect.ts` fills the
section between the markers below. This is **observed style**, not prescribed rules —
when writing new code, match what's here. If the observed style disagrees with a rule
in `.claude/rules/`, the rule wins (the user opted into the rule by leaving it in place).

Re-run `/setupdotclaude` to refresh after significant code changes.

<!-- CLAUDE_REPLACE:observed_patterns -->
_No detection has run yet. Run `npx tsx .claude/scripts/detect.ts | npx tsx .claude/scripts/apply.ts --apply` to populate._
<!-- /CLAUDE_REPLACE:observed_patterns -->

## Using this file

When Claude generates new code (a new controller, service, DTO, module), it should
first read this file to see how existing code in the repo is organized, then mimic
those choices:

- **Naming convention** dictates how filenames are formed (`user-preferences.controller.ts`
  vs `userPreferences.controller.ts`).
- **DTO location** dictates whether DTOs go in a `dto/` folder next to the controller
  (co-located) or in a central `dto/` directory (centralized).
- **Controller layout** tells Claude whether to create a new folder per feature
  (one-per-feature) or add to an existing grouped directory.
- **Injection style** tells Claude whether to use plain constructor injection or
  mix in `@Inject()` decorators.
- **Sampled files** are the actual files the pattern was derived from — read one if
  uncertain, rather than guessing.

If this file says "unknown" for a field, the repo didn't have enough examples to
infer — ask the user, or pick the NestJS default and mention your choice.
