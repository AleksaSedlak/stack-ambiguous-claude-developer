## Verification Commands

```bash
# Type-check without emitting
npx tsc --noEmit

# Lint
npx eslint 'src/**/*.ts' --max-warnings=0

# Format check
npx prettier --check 'src/**/*.ts'

# Unit tests
npx jest

# E2E tests
npx jest --config ./test/jest-e2e.json

# Full build
npm run build
```

## Stack-Specific Review Patterns

- **Missing @Injectable() decorator** — any class listed as a provider in a module must have `@Injectable()`. Without it, NestJS silently fails to resolve the dependency. Check every new or modified provider class.

- **Circular module imports** — Module A imports Module B and Module B imports Module A. This causes undefined behavior at runtime. Fix: extract the shared dependency into a third module, or use `forwardRef()`.

- **Controller doing business logic** — controllers should only handle HTTP concerns (parse request, call service, format response). If a controller method has conditionals, loops, or data transformations beyond simple mapping, the logic belongs in a service.

- **$queryRaw without Prisma.sql** — using `$queryRawUnsafe()` or string concatenation in `$queryRaw`. The tagged template literal form auto-parameterizes; anything else is a SQL injection vector. Every raw query should use the tagged template: `` prisma.$queryRaw`...` ``.

- **Missing ValidationPipe** — new endpoints accepting request bodies without `ValidationPipe` applied. Check that either `app.useGlobalPipes(new ValidationPipe())` is set in `main.ts`, or `@UsePipes(new ValidationPipe())` is on the route. Without it, DTOs with class-validator decorators are not validated.

- **Exposed internal fields in DTOs** — response DTOs that leak database internals like `password`, `hashedPassword`, `internalId`, `deletedAt`, or raw relation IDs. Use `@Exclude()` from class-transformer or explicit response DTO classes with only the intended fields.

- **`any` type usage** — bypasses TypeScript's type system entirely. Check for `any` in new code, especially in service method signatures, DTO properties, and generic type parameters. Use `unknown` with type narrowing instead.

- **Unused module imports** — modules listed in `imports` that are not actually needed by any provider or controller in the module. These add unnecessary coupling and slow down module initialization. Verify each import is used.

- **Missing async/await in lifecycle hooks** — `onModuleInit`, `onModuleDestroy`, `onApplicationBootstrap`, and `onApplicationShutdown` that perform async operations (DB connections, external service setup) but are not declared `async` or don't `await` their promises. This causes race conditions during startup and shutdown.
