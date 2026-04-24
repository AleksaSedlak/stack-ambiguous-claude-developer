## Reproduction Tools

- **Run a single test**: `npx jest --testPathPattern=<file>` or `npx jest --testNamePattern="<name>"`
- **Dev server**: `npm run start:dev` (watches and recompiles)
- **Quick script**: `npx ts-node -e "import { ... } from './src/...'; ..."`
- **HTTP request**: `curl -X POST http://localhost:3000/endpoint -H 'Content-Type: application/json' -d '{"key":"value"}'`
- **Debug mode**: `npm run start:debug` then attach with VS Code or Chrome DevTools on port 9229

## Environment Checks

- **Node version**: `node -v` — check `.nvmrc` or `engines` in `package.json`
- **Package manager**: check for `pnpm-lock.yaml`, `yarn.lock`, or `package-lock.json`
- **TypeScript config**: `cat tsconfig.json` — check `paths`, `baseUrl`, `emitDecoratorMetadata`, `experimentalDecorators` (both must be `true`)
- **NestJS CLI config**: `cat nest-cli.json` — check `sourceRoot`, `compilerOptions`, monorepo `projects`
- **Stale build**: `rm -rf dist/` then rebuild — NestJS incremental compilation can retain deleted/renamed files
- **Database state**: `npx prisma db pull` or `npx prisma migrate status` — check for pending migrations or schema drift
- **Environment variables**: verify `.env` matches `.env.example`, check `ConfigModule.forRoot()` is loaded in the right module

## Common Bug Patterns

- **Circular dependency injection** — runtime error `Cannot read properties of undefined` or `Nest can't resolve dependencies`. Two providers depend on each other. Fix: use `forwardRef(() => ServiceName)` on one side, or restructure to break the cycle.

- **Missing @Injectable() decorator** — `Nest can't resolve dependencies of X` even though the provider is in the module. The class is missing the `@Injectable()` decorator. Fix: add the decorator to the class.

- **Wrong module imports** — a service works in one controller but throws `Nest can't resolve dependencies` in another. The module that exports the service is not imported by the consuming module. Fix: add the module to `imports` in the consuming module, and verify `exports` in the providing module.

- **Floating promises in lifecycle hooks** — `onModuleInit` or `onApplicationBootstrap` does async work but isn't declared `async` or the caller doesn't `await`. Symptom: intermittent startup failures, undefined state during early requests. Fix: mark the hook `async` and ensure `await` on all promises.

- **Guard/interceptor execution order** — guards/interceptors applied at different levels (global, controller, method) don't run in the expected order. Global guards run first, then controller-level, then method-level. Fix: verify the layering, use `APP_GUARD`/`APP_INTERCEPTOR` tokens for global registration order control.

- **Prisma $queryRaw SQL injection** — using string interpolation inside `$queryRaw` instead of tagged template literals. Prisma's tagged template `$queryRaw` auto-parameterizes, but `$queryRawUnsafe` and string concatenation do not. Fix: always use the tagged template form `prisma.$queryRaw\`SELECT ... WHERE id = ${id}\``.

- **DTO validation not triggering** — request body arrives unvalidated. Either `ValidationPipe` is not applied (globally via `app.useGlobalPipes()` or per-route), or the DTO class is missing `class-validator` decorators, or `class-transformer` isn't installed. Fix: ensure `app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))` is set in `main.ts`.

- **Stale dist/ artifacts** — renamed or deleted source files still exist in `dist/`, causing phantom imports or wrong module resolution. Fix: `rm -rf dist/` and rebuild. Consider adding `"clean": "rm -rf dist"` to `package.json` scripts.

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

# Build
npm run build
```
