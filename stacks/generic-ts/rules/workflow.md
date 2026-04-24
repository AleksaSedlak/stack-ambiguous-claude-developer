---
alwaysApply: true
---

# Workflow

## AI-Human Disagreement

If a user's request would introduce a security vulnerability, data loss risk, or clearly
contradict a stated project rule: state the concern once, briefly, with the specific risk.
Then do what they asked if they confirm. Never refuse. Never lecture. Never repeat.

## File Size Signal

If a file exceeds ~300 lines, consider whether it has multiple responsibilities that
should be separate modules. A 400-line file with one cohesive responsibility is fine;
a 200-line file with three unrelated concerns should be split.
