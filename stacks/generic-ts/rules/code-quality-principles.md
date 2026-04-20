---
alwaysApply: true
---

# Code Quality Principles

- Functions do one thing. If you can't name it without "and", split it.
- No magic values — extract to named constants or typed config. Exception: values used once in obvious context.
- Handle errors at the boundary. Don't catch and re-throw without adding context.
- No premature abstractions. Three similar lines > a helper used once.
- Don't add features or "improve" things beyond what was asked.
- No dead code or commented-out blocks. Git has history.
- Prefer named exports over default exports.
- Comments explain WHY, never WHAT. If code needs a "what" comment, rename instead.
