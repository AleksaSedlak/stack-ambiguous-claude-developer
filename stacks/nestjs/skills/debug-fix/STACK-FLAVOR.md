## Reproduction Tools

- Failing unit test: `npx jest --testPathPattern=<file> --testNamePattern="<name>"`
- Failing e2e test: `npx jest --config test/jest-e2e.json --testPathPattern=<file>`
- Dev server: `npm run start:dev` (watch mode) or `npm run start:debug` (with `--inspect`)
- Minimal script: `npx ts-node -e "import { ... } from './src/...'; ..."`
- REPL: `npx ts-node` or `node --loader ts-node/esm` for ESM projects
- Curl against running server: `curl -X POST http://localhost:3000/api/...`

## Environment Checks

- Node version: `node -v`, `.nvmrc`, `.node-version`, `engines.node` in package.json
- Package manager: check for `pnpm-lock.yaml`, `yarn.lock`, `package-lock.json`
- TypeScript config: `tsconfig.json` → `strict`, `paths`, `baseUrl` settings
- NestJS CLI config: `nest-cli.json` → `compilerOptions`, `monorepo`, `projects`
- Cache to clear: `dist/`, `node_modules/.cache/`, `tsconfig.tsbuildinfo`
- Database state: check migrations are applied, connection string is correct
- Monorepo: if using `@nestjs/cli` monorepo mode, verify the correct app/lib is targeted

## Common Bug Patterns

- **Circular dependency injection** — two modules import each other's providers. Symptom: `undefined` provider at runtime, or `Nest can't resolve dependencies` error. Fix: use `forwardRef(() => Module)` or extract shared code to a new module
- **Missing `@Injectable()` decorator** — a class is provided in a module but lacks the decorator. Symptom: `Nest can't resolve dependencies of X`. Fix: add `@Injectable()` to the class
- **Wrong module imports** — a service is used in a controller but its module isn't imported. Symptom: `Error: Nest can't resolve dependencies of XController`. Fix: add the provider's module to the consuming module's `imports` array
- **Floating promises in lifecycle hooks** — `onModuleInit()` or `onApplicationBootstrap()` returns a Promise but NestJS doesn't await it. Symptom: startup completes before async initialization finishes. Fix: make the hook `async` and `await` all operations
- **Guard/Interceptor execution order confusion** — guards run before interceptors, pipes run after. Applying logic in the wrong layer. Symptom: unexpected 403s or missing transformations. Fix: review the NestJS request lifecycle diagram
- **Prisma `$queryRaw` SQL injection** — using string interpolation instead of `Prisma.sql` tagged template. Symptom: no error, but vulnerable to injection. Fix: use `$queryRaw(Prisma.sql\`...\`)` with parameterized values
- **DTO validation not triggering** — `ValidationPipe` not applied globally or `class-validator` decorators missing on DTO properties. Symptom: invalid data passes through. Fix: add `app.useGlobalPipes(new ValidationPipe())` in bootstrap and decorators on DTOs
- **Stale `dist/` after renaming** — TypeScript compiler doesn't delete old output files. Symptom: import resolves to a deleted/renamed file from `dist/`. Fix: `rm -rf dist/ && npm run build`

## Verification Commands

- Type check: `npx tsc --noEmit`
- Lint: `npx eslint "src/**/*.ts"` or `npm run lint`
- Format: `npx prettier --check "src/**/*.ts"` or `npm run format`
- Unit tests: `npx jest` or `npm test`
- E2E tests: `npx jest --config test/jest-e2e.json` or `npm run test:e2e`
- Build: `npm run build` (compiles to `dist/`)
