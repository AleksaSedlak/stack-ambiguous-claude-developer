## Verification Commands

- Type check: `npx tsc --noEmit`
- Lint: `npx eslint "src/**/*.ts"` or `npm run lint`
- Format check: `npx prettier --check "src/**/*.ts"`
- Unit tests: `npx jest` or `npm test`
- E2E tests: `npx jest --config test/jest-e2e.json`
- Build: `npm run build`

## Stack-Specific Review Patterns

- **Missing `@Injectable()`** — any class listed in a module's `providers` must have the decorator
- **Circular module dependencies** — check for modules that import each other. Use `forwardRef()` or extract shared code
- **Controller doing business logic** — controllers should only parse input, call a service, and format output. Logic belongs in services
- **`$queryRaw` without `Prisma.sql`** — string interpolation in raw queries = SQL injection risk
- **Missing `ValidationPipe`** — new endpoints must have DTOs with class-validator decorators. Check the global pipe is applied
- **Exposed internal fields in DTOs** — response DTOs should never include password hashes, internal IDs, or audit fields. Use `@Exclude()` with `ClassSerializerInterceptor` or map explicitly
- **`any` type usage** — check for `any` in service/controller signatures. Should be `unknown` + narrowing
- **Unused module imports** — modules importing providers they don't use waste startup time and create confusing dependency graphs
- **Missing `async`/`await`** — NestJS lifecycle hooks (`onModuleInit`, `onApplicationShutdown`) must be `async` if they do async work
