---
name: setupdotclaude
description: Scan the project and customize .claude/ configuration to match the actual nestjs stack
argument-hint: "[optional: focus area like 'frontend' or 'backend']"
disable-model-invocation: true
---

Scan this NestJS project and customize `.claude/` to match its actual setup.

## Phase 1: Detect Tech Stack

Read the following files to build a detection profile:

### Package Manager
- `pnpm-lock.yaml` exists → **pnpm**
- `yarn.lock` exists → **yarn**
- `bun.lockb` or `bun.lock` exists → **bun**
- `package-lock.json` exists → **npm**
- None found → default to **npm**

### NestJS Version
- Read `package.json` → `dependencies["@nestjs/core"]` — extract the major version (e.g., `10`, `11`)
- If `@nestjs/core` is not in dependencies, this may not be a NestJS project — warn the user

### HTTP Adapter
- `@nestjs/platform-fastify` in dependencies → **Fastify**
- `@nestjs/platform-express` in dependencies (or neither) → **Express** (Express is the default)

### ORM / Database
- `prisma` in devDependencies or `@prisma/client` in dependencies → **Prisma**
- `@nestjs/typeorm` or `typeorm` in dependencies → **TypeORM**
- `drizzle-orm` in dependencies → **Drizzle**
- `@nestjs/mongoose` or `mongoose` in dependencies → **Mongoose**
- None found → **no ORM detected**

### Test Framework
- `jest` in devDependencies (default for NestJS) → **Jest**
- `vitest` in devDependencies → **Vitest**
- Check for `jest.config.ts`, `jest.config.js`, `vitest.config.ts`
- Look for `test/jest-e2e.json` to confirm e2e setup

### Linter / Formatter
- `eslint` in devDependencies → **ESLint** (check for `.eslintrc.js`, `.eslintrc.json`, `eslint.config.mjs`)
- `prettier` in devDependencies → **Prettier** (check for `.prettierrc`, `.prettierrc.json`)
- `@biomejs/biome` in devDependencies → **Biome** (replaces both)

### Monorepo Detection
- Read `nest-cli.json` — if `projects` key exists with multiple entries → **monorepo mode**
- If monorepo, list all project names and their roots

### TypeScript Config
- Read `tsconfig.json` — check `strict`, `emitDecoratorMetadata`, `experimentalDecorators`
- Read `tsconfig.build.json` if it exists — note `outDir` (usually `./dist`)

### Project Structure
- Scan `src/` for the directory layout — is it flat (`src/*.module.ts`) or modular (`src/modules/*/`)?
- Check for common directories: `src/common/`, `src/shared/`, `src/config/`, `src/modules/`
- List feature modules found (directories containing `*.module.ts`)

## Phase 2: Present Findings

Show the user a summary of detected configuration:

```
Detected NestJS project configuration:

  Package manager:   <pm>
  NestJS version:    <version>
  HTTP adapter:      <Express|Fastify>
  ORM:               <Prisma|TypeORM|Drizzle|Mongoose|none>
  Test framework:    <Jest|Vitest>
  Linter:            <ESLint|Biome>
  Formatter:         <Prettier|Biome>
  Monorepo:          <yes (N projects)|no>
  TypeScript strict:  <yes|no>
  Project structure: <flat|modular>
  Feature modules:   <list>

Does this look correct? (y/n, or describe corrections)
```

Wait for user confirmation before proceeding. If they correct something, update the detection profile.

## Phase 3: Customize CLAUDE.md

Read `.claude/CLAUDE.md` and update it:

### Commands Section
Replace placeholder commands with detected values:

- **Dependencies**: `<pm> install` (use detected package manager)
- **Build**: `<pm> run build` or `npx nest build`
- **Type-check**: `npx tsc --noEmit`
- **Test**: `<pm> test`, `<pm> run test:e2e`, `<pm> run test:cov` (from `package.json` scripts)
- **Lint**: `<pm> run lint` or `npx eslint 'src/**/*.ts'`
- **Format**: `<pm> run format` or `npx prettier --write 'src/**/*.ts'`
- **Dev server**: `<pm> run start:dev`
- **Database**: If Prisma → add `npx prisma migrate dev`, `npx prisma generate`, `npx prisma studio`. If TypeORM → add `npx typeorm migration:run`, `npx typeorm migration:generate`. If no ORM → remove the database section entirely.

### Architecture Section
Build the directory tree from the actual project structure:

- Use the detected structure (flat vs modular) to generate an accurate tree
- Include the ORM-specific directories (e.g., `prisma/` for Prisma, `src/entities/` for TypeORM)
- List the actual feature modules found in the project
- Write module boundary rules based on the structure

### Workflow Section
Adjust based on detected tools:

- Use the correct package manager command (`pnpm`, `yarn`, `npm`, `bun`)
- Include ORM-specific workflow steps (e.g., "run `npx prisma generate` after pulling")
- Include the correct format command

## Phase 4: Customize settings.json

Read `.claude/settings.json` and update:

### Permissions
Set `permissions.allow` based on detected package manager and tools:

```json
{
  "permissions": {
    "allow": [
      "<pm> run *",
      "<pm> test *",
      "npx tsc --noEmit",
      "npx jest *",
      "npx eslint *",
      "npx prettier *",
      "npx nest *",
      "<prisma-commands-if-detected>"
    ]
  }
}
```

- If Prisma detected: add `"npx prisma *"`
- If Biome: replace eslint/prettier entries with `"npx biome *"`
- Remove commands for tools not detected (don't add prisma commands if no ORM)

## Phase 5: Customize Rules

Read each rule file in `.claude/rules/` and update paths and content:

- **code-quality.md**: Adjust import path conventions based on detected structure (e.g., `@modules/` if using path aliases)
- **testing.md**: Update test patterns for detected test framework. If Vitest, update examples.
- **api.md**: If Fastify adapter, note Fastify-specific patterns (e.g., `@Req() req: FastifyRequest` instead of `@Req() req: Request`)
- **database.md**: If no ORM detected, remove this rule file entirely. If TypeORM, replace Prisma-specific patterns with TypeORM patterns. If Mongoose, replace with Mongoose patterns.
- **error-handling.md**: No ORM-specific changes needed, but verify exception filter patterns match the HTTP adapter
- **security.md**: Update SQL injection patterns based on detected ORM

## Phase 6: Generate workflow-commands.json

Read `package.json` scripts and generate `.claude/workflow-commands.json`:

```json
{
  "typecheck": {
    "command": "npx tsc --noEmit",
    "description": "Type-check without emitting files"
  },
  "lint": {
    "command": "<pm> run lint",
    "description": "Run ESLint on source files"
  },
  "test": {
    "command": "<pm> test",
    "description": "Run all unit tests"
  },
  "test:e2e": {
    "command": "<pm> run test:e2e",
    "description": "Run end-to-end tests"
  },
  "build": {
    "command": "<pm> run build",
    "description": "Compile TypeScript and build the project"
  },
  "format": {
    "command": "<pm> run format",
    "description": "Format source files with Prettier"
  }
}
```

- Only include commands that have corresponding scripts in `package.json`
- If a script doesn't exist (e.g., no `test:e2e`), omit it
- If Prisma: add `"db:migrate"` and `"db:generate"` entries
- Use the detected package manager for all commands

## Phase 7: Handle Empty / New Project

If the project has a minimal or empty `src/` (no feature modules, only `app.module.ts`):

1. Inform the user: "This looks like a fresh NestJS project. I'll apply sensible defaults."
2. Apply defaults:
   - Package manager: **npm** (unless a lockfile says otherwise)
   - Test framework: **Jest** (NestJS default)
   - Linter/formatter: **ESLint + Prettier** (NestJS CLI default)
   - ORM: **Prisma** (offer as recommendation, ask user to confirm)
   - Structure: **modular** (`src/modules/<feature>/`)
3. Set up the architecture section with the recommended modular structure
4. Include all database commands (user can remove if not using an ORM)
5. Ask: "Would you like me to keep these defaults, or adjust anything?"

## Phase 8: Summary

After all changes are made, show the user what was updated:

```
.claude/ configuration customized for your NestJS project:

  Updated files:
  - CLAUDE.md — commands, architecture, workflow
  - settings.json — permissions for <pm>
  - rules/database.md — <updated for ORM | removed (no ORM)>
  - rules/api.md — <updated for adapter>
  - workflow-commands.json — <N> commands generated

  Detected stack:
  - <pm> + NestJS <version> + <adapter> + <ORM> + <test> + <linter>

Review CLAUDE.md to verify the architecture section matches your project.
Run /review to validate the setup against your codebase.
```
