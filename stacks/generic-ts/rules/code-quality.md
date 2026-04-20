---
alwaysApply: true
---

# Code Quality

## Principles

- Functions do one thing. If you can't name it without "and", split it.
- No magic values — extract numbers, strings, and config to named constants or typed config.
  Exception: values used once where meaning is obvious from context (array index 0, HTTP 200, string in a single test assertion).
- Handle errors at the boundary. Don't catch and re-throw without adding context.
- No premature abstractions. Three similar lines > a helper used once.
- Don't add features or "improve" things beyond what was asked.
- No dead code or commented-out blocks. Git has history.

## TypeScript

- `strict: true`. Also: `noUncheckedIndexedAccess`, `noImplicitOverride`,
  `noFallthroughCasesInSwitch`.
- No `any` in application code. Use `unknown` and narrow explicitly.
- No non-null assertions (`foo!`) except after a proven existence check or on regex captures.
- Explicit return types on exported functions with complex returns (unions, Promises,
  generics). Inference is fine for trivial getters, wrappers, and internal helpers.
- Prefer `interface` for object shapes that may extend; `type` for unions, intersections,
  mapped, conditional, and function types.
- Discriminated unions over flags: `{ kind: 'ok'; value: T } | { kind: 'err'; error: E }`.
- `readonly` by default for fields; `ReadonlyArray<T>` / `readonly T[]` for input params
  that shouldn't be mutated.
- `as const` for literal tuples and config objects. Avoid `as SomeType` casts — narrow instead.

## Naming

- **Files**: `kebab-case.ts` for modules, `PascalCase.tsx` for React components
  (`user-service.ts`, `UserCard.tsx`). Test files match source: `user-service.test.ts`.
- **Classes / types / interfaces / enums**: `PascalCase` — `UserService`, `type OrderId`,
  `interface BillingClient`.
- **Variables / functions**: `camelCase` — `getUser`, `validateEmail`, `handleClick`.
- **Constants**: `SCREAMING_SNAKE_CASE` only for true top-level module constants
  (`MAX_RETRIES`, `DEFAULT_TIMEOUT_MS`). Inline literals used once stay inline.
- **Booleans**: `is`/`has`/`should`/`can` prefix — `isValid`, `hasPermission`, `canEdit`.
- **Event handlers**: `handle<Thing>` for the impl, `on<Thing>` for the prop —
  `handleSubmit` internally, `onSubmit` on the component.
- **Private class members**: leading `_` OR TypeScript `private` — pick one per project
  and stick to it. Prefer `#privateField` in modern runtimes for true privacy.
- **Abbreviations**: only universally known — `id`, `url`, `api`, `db`, `http`, `auth`,
  `config`. Avoid `usr`, `btn`, `mgr`, `svc`.

## TSDoc / JSDoc

Add TSDoc only when behavior isn't obvious from the signature — thrown errors, side
effects, non-obvious parameter constraints, cancellation semantics. If
`getUser(id: UserId): Promise<User | null>` is self-explanatory, don't wrap it in a
doc block that restates what the types already say.

When you do write TSDoc:
- `@throws` for every error class the function can throw.
- `@deprecated` with a migration hint, never without one.
- Don't restate the obvious (`@param id - the id`). Describe intent, constraints, side effects.
- Private functions don't need TSDoc unless they're non-obvious.

## Module Structure

Follow existing file structure in the project. For new files: imports at top, exports
visible before internal helpers, supporting functions in call order (top-to-bottom reads
as a story). Import ordering is handled by tooling (eslint-plugin-import or prettier
plugin) — don't manually reorder.

Prefer named exports over default exports. Default exports break rename refactors and grep.

## Patterns

**Prefer narrowing over casting:**
```ts
// good
if (typeof value === 'string') {
  console.log(value.trim());
}

// avoid
console.log((value as string).trim());
```

**Exhaustive switch on discriminated unions:**
```ts
type Event = { kind: 'click' } | { kind: 'hover' } | { kind: 'blur' };

function handle(e: Event): void {
  switch (e.kind) {
    case 'click': return click();
    case 'hover': return hover();
    case 'blur': return blur();
    default: {
      const _exhaustive: never = e; // compile error if a case is missing
      throw new Error(`Unhandled event: ${JSON.stringify(_exhaustive)}`);
    }
  }
}
```

**Async pipelines via `await`, not `.then` chains:**
```ts
// good — linear, uses try/catch
const user = await fetchUser(id);
const account = await fetchAccount(user.accountId);

// avoid — harder to read, harder to debug
fetchUser(id).then(u => fetchAccount(u.accountId)).then(a => ...);
```

**Fire independent async work in parallel:**
```ts
// good — two independent calls run concurrently
const [user, settings] = await Promise.all([fetchUser(id), fetchSettings(id)]);

// avoid — serial for no reason, double the latency
const user = await fetchUser(id);
const settings = await fetchSettings(id);
```

## Comments

- **WHY**, never WHAT. If the code needs a "what" comment, rename instead.
- TSDoc when behavior isn't obvious from the signature. Internal helpers only when non-obvious.
- Comment non-obvious decisions, workarounds with issue links, complex algorithm steps.
- No commented-out code — delete it. No journal comments — git blame does this.

## Code Markers

| Marker | Use |
|---|---|
| `// TODO(author): desc (#issue)` | Planned work |
| `// FIXME(author): desc (#issue)` | Known bugs |
| `// HACK(author): desc (#issue)` | Ugly workarounds (explain the proper fix) |
| `// NOTE: desc` | Non-obvious context for future readers |

Must have an owner. Include issue link when tracked. Don't commit TODOs you can do now.
