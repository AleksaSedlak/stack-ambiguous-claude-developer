---
description: Code quality patterns for NestJS/TypeScript
alwaysApply: true
---

## Principles

**Don't:** Write services or controllers that handle multiple responsibilities separated by comment blocks.
**Do:** One class, one responsibility. Extract shared logic into dedicated providers. Keep controllers under 150 lines — if a controller grows beyond that, split by sub-resource or extract a facade service.
**Why:** NestJS modules are the unit of encapsulation. Small, focused providers are injectable, testable, and replaceable without touching unrelated code.

Additional guidelines:
- Prefer composition over inheritance for services — inject collaborators rather than extending base classes
- Each module should be self-contained: if you remove it, only its dependents break
- Avoid barrel files (`index.ts`) that re-export everything — they create hidden coupling and break tree-shaking

## Language/Type Safety

**Don't:** Use `any` to silence type errors, skip explicit return types on public methods, or leave `strict: false` in tsconfig.
**Do:** Enable `"strict": true` and `"noUncheckedIndexedAccess": true` in tsconfig. Use explicit return types on every exported function and method. Use discriminated unions for domain states (`type Result = { ok: true; data: T } | { ok: false; error: E }`). Prefer `unknown` over `any` when the type is genuinely unknown.
**Why:** NestJS runs at runtime what TypeScript validates at compile time. Disabling strict mode lets malformed data flow silently through DI into production.

Additional guidelines:
- Enable `noImplicitReturns` and `noFallthroughCasesInSwitch` in tsconfig
- Use `satisfies` operator to validate object shapes without widening types
- Prefer `interface` for object shapes and `type` for unions, intersections, and mapped types
- Never use non-null assertion (`!`) without a comment explaining why the value is guaranteed

## Naming

**Don't:** Deviate from NestJS file conventions or use inconsistent casing across the project.
**Do:** Follow NestJS naming conventions strictly:
- Files: kebab-case with role suffix — `users.controller.ts`, `users.service.ts`, `users.module.ts`
- DTOs: `dto/create-user.dto.ts`, `dto/update-user.dto.ts`
- Entities: `entities/user.entity.ts`
- Guards/Pipes/Interceptors: `guards/roles.guard.ts`, `pipes/parse-id.pipe.ts`
- Classes: PascalCase — `UsersController`, `UsersService`, `CreateUserDto`
- Interfaces: PascalCase prefixed with `I` only if project convention, otherwise plain PascalCase
- Only abbreviate universally known terms (`id`, `url`, `api`, `db`, `dto`)
**Why:** NestJS CLI and documentation assume these conventions. Deviating breaks `nest generate` output and makes the codebase unnavigable for new developers.

## Patterns

**Don't:** Instantiate dependencies with `new` inside classes, import services across module boundaries without exporting, or create circular module imports.
**Do:** Use dependency injection for everything — let the NestJS container manage lifecycle. Export only what other modules need. Use `forwardRef()` only as a last resort for circular dependencies and document why. Use `Promise.all()` for independent async operations within a single handler.
**Why:** Manual instantiation bypasses the DI container, breaking testing (can't mock), lifecycle hooks (onModuleInit won't fire), and scope management (request-scoped providers fail silently).

Additional guidelines:
- Use custom providers (`useFactory`, `useClass`) when you need conditional or configured instances
- Prefer `@Injectable({ scope: Scope.DEFAULT })` (singleton) unless you specifically need request scope
- Never mutate injected dependencies — treat them as read-only collaborators

## Comments

**Don't:** Write comments that restate the code (`// inject users service`) or leave commented-out code blocks.
**Do:** Use TSDoc (`/** */`) on every exported class and method. Document `@param`, `@returns`, and `@throws HttpException` variants. Comment non-obvious decisions, workarounds with issue links, and algorithm rationale.
**Why:** NestJS projects grow fast with many providers. TSDoc powers IDE tooltips across module boundaries. `@throws` documentation prevents callers from missing error cases.
