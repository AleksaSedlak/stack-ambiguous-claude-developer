---
name: explain
description: Explain code with visual diagrams and clear mental models
argument-hint: "[file, function, or concept]"
disable-model-invocation: true
---

Explain `$ARGUMENTS` clearly.

## Format

### 1. One-sentence summary
What does it do and why does it exist? One sentence.

### 2. Mental model
Give an analogy or metaphor that captures the core idea. Relate it to something the developer already knows.

### 3. Visual diagram
Draw an ASCII diagram showing the data/control flow. Keep it readable:
```
Request → [Validate] → [Service] → [Repository] → DB
                              ↓
                         [Event bus]
```

For async flows, show awaits and concurrency explicitly:
```
await a()   ──┐
await b()   ──┼─ sequential
await c()   ──┘

Promise.all([a(), b(), c()])  ── concurrent
```

### 4. Key details
Walk through the important parts. Skip the obvious — focus on:
- Non-obvious decisions (why this approach?)
- Edge cases and gotchas
- Dependencies and side effects (network calls, DB writes, file I/O, event emissions)
- Type system constraints and generics
- Boundaries (server vs client, public vs internal)

### 5. How to modify it
What would someone need to know to safely change this code? Where are the landmines?
- Who calls this? (use grep / find references)
- What does it call? (downstream effects)
- What tests cover it, and which branches do they cover?
- What would change if the interface/signature changed?
