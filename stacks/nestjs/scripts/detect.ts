#!/usr/bin/env tsx
/**
 * detect.ts — Scan a NestJS project (single-app or monorepo) and emit a JSON
 * description of its stack, data stores, inter-service communication, and
 * observed code patterns.
 *
 * Usage:
 *   npx tsx .claude/scripts/detect.ts                # scan cwd, print JSON to stdout
 *   npx tsx .claude/scripts/detect.ts --root ../foo  # scan a different root
 *   npx tsx .claude/scripts/detect.ts --pretty       # pretty-print JSON
 *
 * Pipes into apply.ts:
 *   npx tsx .claude/scripts/detect.ts | npx tsx .claude/scripts/apply.ts
 *
 * Schema version 2 (monorepo-aware, multi-DB, communication, observed patterns).
 * No dependencies — Node built-ins only.
 */

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve, join, relative, basename } from 'node:path';
import { argv, stdout, exit } from 'node:process';

// ──────────────────────────────────────────────────────────
// Types — contract apply.ts reads
// ──────────────────────────────────────────────────────────

type OrmKind = 'prisma' | 'typeorm' | 'drizzle' | 'mongoose' | 'native' | null;
type DatabaseKind =
  | 'postgres'
  | 'mysql'
  | 'mongodb'
  | 'sqlite'
  | 'influxdb'
  | 'redis'
  | 'unknown';
type CommsKind =
  | 'http'
  | 'rabbitmq'
  | 'kafka'
  | 'redis-pubsub'
  | 'grpc'
  | 'events'
  | 'queue'
  | 'nest-microservices';

interface Database {
  kind: DatabaseKind;
  driver: string;
  orm: OrmKind;
  apps: string[];
  migrationDirs: string[];
}

interface CommsChannel {
  kind: CommsKind;
  driver: string;
  apps: string[];
}

interface AppInfo {
  name: string;
  path: string; // relative to projectRoot, '.' for single-app
  isNestJS: boolean;
  nestVersion: string | null;
  httpAdapter: 'express' | 'fastify' | 'unknown';
  databases: Database[];
  communication: CommsChannel[];
  hasSwagger: boolean;
  hasAuth: { passport: boolean; jwt: boolean; throttler: boolean };
  srcLayout: {
    srcDir: string | null;
    hasMainTs: boolean;
    hasAppModule: boolean;
    hasModulesFolder: boolean;
    controllerGlob: string | null;
  };
}

interface ObservedPatterns {
  sampledFiles: string[];
  namingConvention: 'kebab-case' | 'camelCase' | 'mixed' | 'unknown';
  controllerFileLayout: 'one-per-feature' | 'grouped' | 'unknown';
  dtoLocation: 'co-located' | 'centralized' | 'mixed' | 'unknown';
  constructorInjection: 'standard' | 'mixed-with-@Inject' | 'unknown';
  notes: string[]; // prose observations
}

interface Detection {
  schemaVersion: 2;
  projectRoot: string;
  scannedAt: string;

  isNestJS: boolean;
  nestVersion: string | null;

  packageManager: 'npm' | 'pnpm' | 'yarn' | 'bun' | 'unknown';
  nodeVersion: string | null;

  // Aggregated across apps
  httpAdapter: 'express' | 'fastify' | 'mixed' | 'unknown';
  testFramework: 'jest' | 'vitest' | 'node-test' | 'mocha' | 'unknown';
  linter: 'eslint' | 'biome' | 'both' | 'unknown';
  formatter: 'prettier' | 'biome' | 'unknown';

  databases: Database[];
  communication: CommsChannel[];

  hasConfig: boolean;
  hasSwagger: boolean;
  hasObservability: { pino: boolean; winston: boolean };

  scripts: {
    install: string | null;
    build: string | null;
    test: string | null;
    testE2E: string | null;
    dev: string | null;
    lint: string | null;
    lintFix: string | null;
    format: string | null;
    migrate: string | null;
    migrateRollback: string | null;
    typecheck: string | null;
  };

  monorepo: {
    isMonorepo: boolean;
    tool: 'pnpm' | 'turbo' | 'nx' | 'yarn' | 'bun' | null;
    workspaces: string[];
    apps: AppInfo[];
  };

  // Kept for single-app compatibility; in monorepos it's "."
  srcLayout: AppInfo['srcLayout'];

  observedPatterns: ObservedPatterns;

  obsidian: {
    configured: boolean;
    vaultPath: string | null;
  };

  claudeMdReplacements: Record<string, string>;
  recommendedRulePathRewrites: Array<{
    file: string;
    addPaths: string[];
    removePaths: string[];
  }>;
  recommendedDeletes: string[];

  warnings: string[];
  errors: string[];
}

interface PkgJson {
  name?: string;
  version?: string;
  engines?: { node?: string };
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
}

// ──────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────

function readJsonSafe(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function exists(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readTextSafe(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function hasDep(pkg: PkgJson | null, name: string): boolean {
  if (!pkg) return false;
  return (
    Boolean(pkg.dependencies?.[name]) ||
    Boolean(pkg.devDependencies?.[name]) ||
    Boolean(pkg.peerDependencies?.[name]) ||
    Boolean(pkg.optionalDependencies?.[name])
  );
}

function depVersion(pkg: PkgJson | null, name: string): string | null {
  if (!pkg) return null;
  return (
    pkg.dependencies?.[name] ??
    pkg.devDependencies?.[name] ??
    pkg.peerDependencies?.[name] ??
    pkg.optionalDependencies?.[name] ??
    null
  );
}

/**
 * Expand a workspace glob. We only handle the common cases:
 *   "apps/*"       → immediate subdirs of apps/
 *   "packages/*"   → immediate subdirs of packages/
 *   "foo/bar"      → exact path (no glob)
 * Complex patterns like "**\/*" return [] with a warning.
 */
function expandWorkspaceGlob(root: string, pattern: string): {
  dirs: string[];
  warning?: string;
} {
  if (pattern.includes('**')) {
    return { dirs: [], warning: `Skipping workspace pattern "${pattern}" — ** globs not supported.` };
  }
  const trailingStar = pattern.match(/^(.+?)\/\*$/);
  if (trailingStar) {
    const parentRel = trailingStar[1]!;
    const parentAbs = join(root, parentRel);
    if (!isDir(parentAbs)) return { dirs: [] };
    const subs: string[] = [];
    try {
      for (const entry of readdirSync(parentAbs, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory() && exists(join(parentAbs, entry.name, 'package.json'))) {
          subs.push(`${parentRel}/${entry.name}`);
        }
      }
    } catch {
      // ignore
    }
    return { dirs: subs };
  }
  if (pattern.includes('*')) {
    return { dirs: [], warning: `Skipping workspace pattern "${pattern}" — only "dir/*" form supported.` };
  }
  return { dirs: isDir(join(root, pattern)) ? [pattern] : [] };
}

// ──────────────────────────────────────────────────────────
// Top-level detection (root-level facts)
// ──────────────────────────────────────────────────────────

function detectPackageManager(root: string): Detection['packageManager'] {
  if (exists(join(root, 'pnpm-lock.yaml'))) return 'pnpm';
  if (exists(join(root, 'bun.lockb')) || exists(join(root, 'bun.lock'))) return 'bun';
  if (exists(join(root, 'yarn.lock'))) return 'yarn';
  if (exists(join(root, 'package-lock.json'))) return 'npm';
  return 'unknown';
}

function detectNodeVersion(root: string, pkg: PkgJson | null): string | null {
  const nvmrc = readTextSafe(join(root, '.nvmrc'));
  if (nvmrc) return nvmrc.trim();
  const toolVersions = readTextSafe(join(root, '.tool-versions'));
  if (toolVersions) {
    const match = toolVersions.match(/^nodejs\s+(\S+)/m);
    if (match) return match[1]!;
  }
  return pkg?.engines?.node ?? null;
}

function detectTestFramework(
  pkgs: PkgJson[],
  rootPkg: PkgJson | null
): Detection['testFramework'] {
  const anyHasDep = (name: string) => pkgs.some((p) => hasDep(p, name));
  if (anyHasDep('vitest')) return 'vitest';
  if (anyHasDep('jest') || anyHasDep('@nestjs/testing')) return 'jest';
  if (anyHasDep('mocha')) return 'mocha';
  const testScript = rootPkg?.scripts?.test ?? '';
  if (/node\s+--test/.test(testScript)) return 'node-test';
  return 'unknown';
}

function detectLinter(pkgs: PkgJson[], root: string): Detection['linter'] {
  const anyHasDep = (name: string) => pkgs.some((p) => hasDep(p, name));
  const hasBiome = anyHasDep('@biomejs/biome') || exists(join(root, 'biome.json'));
  const hasEslint =
    anyHasDep('eslint') ||
    exists(join(root, '.eslintrc.js')) ||
    exists(join(root, '.eslintrc.cjs')) ||
    exists(join(root, '.eslintrc.json')) ||
    exists(join(root, 'eslint.config.js')) ||
    exists(join(root, 'eslint.config.mjs'));
  if (hasBiome && hasEslint) return 'both';
  if (hasBiome) return 'biome';
  if (hasEslint) return 'eslint';
  return 'unknown';
}

function detectFormatter(pkgs: PkgJson[], root: string): Detection['formatter'] {
  const anyHasDep = (name: string) => pkgs.some((p) => hasDep(p, name));
  const hasPrettier =
    anyHasDep('prettier') ||
    exists(join(root, '.prettierrc')) ||
    exists(join(root, '.prettierrc.json')) ||
    exists(join(root, '.prettierrc.js')) ||
    exists(join(root, '.prettierrc.cjs')) ||
    exists(join(root, 'prettier.config.js'));
  const hasBiome = anyHasDep('@biomejs/biome') || exists(join(root, 'biome.json'));
  if (hasPrettier) return 'prettier';
  if (hasBiome) return 'biome';
  return 'unknown';
}

// ──────────────────────────────────────────────────────────
// Per-app detection
// ──────────────────────────────────────────────────────────

function detectHttpAdapter(pkg: PkgJson | null): AppInfo['httpAdapter'] {
  if (hasDep(pkg, '@nestjs/platform-fastify')) return 'fastify';
  if (hasDep(pkg, '@nestjs/platform-express')) return 'express';
  return 'unknown';
}

function detectDatabases(pkg: PkgJson | null, appRoot: string): Database[] {
  const dbs: Database[] = [];
  const apps: string[] = []; // filled in later by aggregator

  if (hasDep(pkg, '@prisma/client') || hasDep(pkg, 'prisma')) {
    const schema = readTextSafe(join(appRoot, 'prisma', 'schema.prisma')) ?? '';
    let kind: DatabaseKind = 'postgres';
    if (/provider\s*=\s*"mysql"/.test(schema)) kind = 'mysql';
    else if (/provider\s*=\s*"mongodb"/.test(schema)) kind = 'mongodb';
    else if (/provider\s*=\s*"sqlite"/.test(schema)) kind = 'sqlite';
    const migrationDirs: string[] = [];
    if (isDir(join(appRoot, 'prisma', 'migrations'))) migrationDirs.push('prisma/migrations');
    dbs.push({ kind, driver: '@prisma/client', orm: 'prisma', apps, migrationDirs });
  }

  if (hasDep(pkg, '@nestjs/mongoose') || hasDep(pkg, 'mongoose')) {
    dbs.push({
      kind: 'mongodb',
      driver: hasDep(pkg, '@nestjs/mongoose') ? '@nestjs/mongoose' : 'mongoose',
      orm: 'mongoose',
      apps,
      migrationDirs: [],
    });
  }

  if (hasDep(pkg, '@influxdata/influxdb-client') || hasDep(pkg, '@influxdata/influxdb-client-apis')) {
    dbs.push({
      kind: 'influxdb',
      driver: '@influxdata/influxdb-client',
      orm: 'native',
      apps,
      migrationDirs: [],
    });
  }

  if (hasDep(pkg, '@nestjs/typeorm') || hasDep(pkg, 'typeorm')) {
    let kind: DatabaseKind = 'unknown';
    if (hasDep(pkg, 'pg')) kind = 'postgres';
    else if (hasDep(pkg, 'mysql2')) kind = 'mysql';
    else if (hasDep(pkg, 'sqlite3') || hasDep(pkg, 'better-sqlite3')) kind = 'sqlite';
    const migrationDirs: string[] = [];
    if (isDir(join(appRoot, 'src', 'migrations'))) migrationDirs.push('src/migrations');
    if (isDir(join(appRoot, 'migrations'))) migrationDirs.push('migrations');
    dbs.push({ kind, driver: 'typeorm', orm: 'typeorm', apps, migrationDirs });
  }

  if (hasDep(pkg, 'drizzle-orm')) {
    let kind: DatabaseKind = 'unknown';
    if (hasDep(pkg, 'pg') || hasDep(pkg, 'postgres')) kind = 'postgres';
    else if (hasDep(pkg, 'mysql2')) kind = 'mysql';
    else if (hasDep(pkg, 'better-sqlite3')) kind = 'sqlite';
    const migrationDirs: string[] = [];
    if (isDir(join(appRoot, 'drizzle'))) migrationDirs.push('drizzle');
    if (isDir(join(appRoot, 'db'))) migrationDirs.push('db');
    dbs.push({ kind, driver: 'drizzle-orm', orm: 'drizzle', apps, migrationDirs });
  }

  // Raw drivers (only register if no ORM claimed them)
  const hasPostgresAlready = dbs.some((d) => d.kind === 'postgres');
  if (!hasPostgresAlready && (hasDep(pkg, 'pg') || hasDep(pkg, 'postgres'))) {
    dbs.push({
      kind: 'postgres',
      driver: hasDep(pkg, 'pg') ? 'pg' : 'postgres',
      orm: 'native',
      apps,
      migrationDirs: [],
    });
  }
  const hasMysqlAlready = dbs.some((d) => d.kind === 'mysql');
  if (!hasMysqlAlready && hasDep(pkg, 'mysql2')) {
    dbs.push({ kind: 'mysql', driver: 'mysql2', orm: 'native', apps, migrationDirs: [] });
  }
  if (hasDep(pkg, 'better-sqlite3') && !dbs.some((d) => d.kind === 'sqlite')) {
    dbs.push({ kind: 'sqlite', driver: 'better-sqlite3', orm: 'native', apps, migrationDirs: [] });
  }
  if (hasDep(pkg, 'ioredis') || hasDep(pkg, 'redis')) {
    dbs.push({
      kind: 'redis',
      driver: hasDep(pkg, 'ioredis') ? 'ioredis' : 'redis',
      orm: 'native',
      apps,
      migrationDirs: [],
    });
  }

  return dbs;
}

function detectCommunication(pkg: PkgJson | null, appRoot: string): CommsChannel[] {
  const channels: CommsChannel[] = [];
  const apps: string[] = [];

  if (hasDep(pkg, '@nestjs/bullmq') || hasDep(pkg, 'bullmq')) {
    channels.push({ kind: 'queue', driver: hasDep(pkg, '@nestjs/bullmq') ? '@nestjs/bullmq' : 'bullmq', apps });
  } else if (hasDep(pkg, '@nestjs/bull') || hasDep(pkg, 'bull')) {
    channels.push({ kind: 'queue', driver: hasDep(pkg, '@nestjs/bull') ? '@nestjs/bull' : 'bull', apps });
  }

  if (hasDep(pkg, 'kafkajs')) {
    channels.push({ kind: 'kafka', driver: 'kafkajs', apps });
  }

  if (hasDep(pkg, 'amqplib') || hasDep(pkg, 'amqp-connection-manager') || hasDep(pkg, '@golevelup/nestjs-rabbitmq')) {
    const driver = hasDep(pkg, '@golevelup/nestjs-rabbitmq')
      ? '@golevelup/nestjs-rabbitmq'
      : hasDep(pkg, 'amqp-connection-manager')
      ? 'amqp-connection-manager'
      : 'amqplib';
    channels.push({ kind: 'rabbitmq', driver, apps });
  }

  if (hasDep(pkg, '@grpc/grpc-js')) {
    channels.push({ kind: 'grpc', driver: '@grpc/grpc-js', apps });
  }

  if (hasDep(pkg, '@nestjs/event-emitter')) {
    channels.push({ kind: 'events', driver: '@nestjs/event-emitter', apps });
  }

  if (hasDep(pkg, '@nestjs/axios') || hasDep(pkg, 'axios')) {
    channels.push({
      kind: 'http',
      driver: hasDep(pkg, '@nestjs/axios') ? '@nestjs/axios' : 'axios',
      apps,
    });
  }

  if (hasDep(pkg, '@nestjs/microservices')) {
    channels.push({ kind: 'nest-microservices', driver: '@nestjs/microservices', apps });
  }

  return channels;
}

function pickScript(pkg: PkgJson | null, candidates: string[]): string | null {
  const scripts = pkg?.scripts ?? {};
  for (const name of candidates) {
    if (scripts[name]) return name;
  }
  return null;
}

function detectScripts(pkg: PkgJson | null): Detection['scripts'] {
  return {
    install: 'install',
    build: pickScript(pkg, ['build']),
    test: pickScript(pkg, ['test']),
    testE2E: pickScript(pkg, ['test:e2e', 'e2e']),
    dev: pickScript(pkg, ['start:dev', 'dev', 'start']),
    lint: pickScript(pkg, ['lint']),
    lintFix: pickScript(pkg, ['lint:fix']),
    format: pickScript(pkg, ['format']),
    migrate: pickScript(pkg, [
      'migrate',
      'migrate:deploy',
      'migration:run',
      'db:migrate',
      'prisma:migrate',
      'drizzle:migrate',
    ]),
    migrateRollback: pickScript(pkg, [
      'migrate:rollback',
      'migration:revert',
      'db:rollback',
      'prisma:rollback',
      'drizzle:rollback',
    ]),
    typecheck: pickScript(pkg, ['typecheck', 'type-check', 'tsc']),
  };
}

function detectAppSrcLayout(appRoot: string): AppInfo['srcLayout'] {
  const srcDir = isDir(join(appRoot, 'src')) ? 'src' : null;
  const hasMainTs = srcDir !== null && exists(join(appRoot, srcDir, 'main.ts'));
  const hasAppModule = srcDir !== null && exists(join(appRoot, srcDir, 'app.module.ts'));
  const hasModulesFolder = srcDir !== null && isDir(join(appRoot, srcDir, 'modules'));
  let controllerGlob: string | null = null;
  if (srcDir !== null && hasControllerFiles(join(appRoot, srcDir))) {
    controllerGlob = `${srcDir}/**/*.controller.ts`;
  }
  return { srcDir, hasMainTs, hasAppModule, hasModulesFolder, controllerGlob };
}

function hasControllerFiles(dir: string, depth = 0): boolean {
  if (depth > 5) return false;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory() && hasControllerFiles(p, depth + 1)) return true;
      if (entry.isFile() && /\.controller\.ts$/.test(entry.name)) return true;
    }
  } catch {
    // ignore
  }
  return false;
}

function findControllerFiles(
  dir: string,
  out: string[],
  maxFiles: number,
  depth = 0
): void {
  if (out.length >= maxFiles || depth > 6) return;
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        findControllerFiles(p, out, maxFiles, depth + 1);
      } else if (entry.isFile() && /\.controller\.ts$/.test(entry.name)) {
        out.push(p);
        if (out.length >= maxFiles) return;
      }
    }
  } catch {
    // ignore
  }
}

// ──────────────────────────────────────────────────────────
// App enumeration
// ──────────────────────────────────────────────────────────

function detectMonorepo(
  root: string,
  pkg: PkgJson | null,
  warnings: string[]
): { tool: Detection['monorepo']['tool']; workspaces: string[]; isMonorepo: boolean } {
  const workspaces: string[] = [];
  let tool: Detection['monorepo']['tool'] = null;

  // Tool detection
  if (exists(join(root, 'pnpm-workspace.yaml'))) {
    tool = 'pnpm';
    const text = readTextSafe(join(root, 'pnpm-workspace.yaml')) ?? '';
    const matches = text.match(/^\s*-\s+['"]?([^'"\n]+)['"]?/gm) ?? [];
    for (const m of matches) {
      const val = m.replace(/^\s*-\s+['"]?/, '').replace(/['"]?\s*$/, '');
      workspaces.push(val);
    }
  } else if (exists(join(root, 'turbo.json'))) {
    tool = 'turbo';
  } else if (exists(join(root, 'nx.json'))) {
    tool = 'nx';
  }

  // package.json workspaces (any package manager)
  if (pkg?.workspaces) {
    tool ??= 'yarn';
    const ws = Array.isArray(pkg.workspaces) ? pkg.workspaces : pkg.workspaces.packages ?? [];
    for (const w of ws) if (!workspaces.includes(w)) workspaces.push(w);
  }

  return { tool, workspaces, isMonorepo: tool !== null || workspaces.length > 0 };
}

function enumerateApps(
  root: string,
  rootPkg: PkgJson | null,
  monorepo: { isMonorepo: boolean; workspaces: string[] },
  warnings: string[]
): AppInfo[] {
  if (!monorepo.isMonorepo) {
    if (!rootPkg) return [];
    return [makeApp(root, '.', rootPkg)];
  }
  const apps: AppInfo[] = [];
  const seen = new Set<string>();
  for (const ws of monorepo.workspaces) {
    const { dirs, warning } = expandWorkspaceGlob(root, ws);
    if (warning) warnings.push(warning);
    for (const dir of dirs) {
      if (seen.has(dir)) continue;
      seen.add(dir);
      const pkg = readJsonSafe(join(root, dir, 'package.json')) as PkgJson | null;
      if (!pkg) continue;
      apps.push(makeApp(root, dir, pkg));
    }
  }
  // Also include the root itself if it has its own nest code (rare but possible)
  if (rootPkg && (hasDep(rootPkg, '@nestjs/core') || hasDep(rootPkg, '@nestjs/common'))) {
    apps.push(makeApp(root, '.', rootPkg));
  }
  return apps;
}

function makeApp(root: string, relPath: string, pkg: PkgJson): AppInfo {
  const appRoot = relPath === '.' ? root : join(root, relPath);
  const isNestJS = hasDep(pkg, '@nestjs/core') || hasDep(pkg, '@nestjs/common');
  const nestVersion =
    depVersion(pkg, '@nestjs/core') ?? depVersion(pkg, '@nestjs/common') ?? null;
  return {
    name: pkg.name ?? basename(appRoot),
    path: relPath,
    isNestJS,
    nestVersion,
    httpAdapter: detectHttpAdapter(pkg),
    databases: detectDatabases(pkg, appRoot),
    communication: detectCommunication(pkg, appRoot),
    hasSwagger: hasDep(pkg, '@nestjs/swagger'),
    hasAuth: {
      passport: hasDep(pkg, '@nestjs/passport'),
      jwt: hasDep(pkg, '@nestjs/jwt') || hasDep(pkg, 'jsonwebtoken'),
      throttler: hasDep(pkg, '@nestjs/throttler'),
    },
    srcLayout: detectAppSrcLayout(appRoot),
  };
}

// ──────────────────────────────────────────────────────────
// Aggregation across apps
// ──────────────────────────────────────────────────────────

function aggregateHttpAdapter(apps: AppInfo[]): Detection['httpAdapter'] {
  const set = new Set(apps.map((a) => a.httpAdapter).filter((a) => a !== 'unknown'));
  if (set.size === 0) return 'unknown';
  if (set.size === 1) return (set.values().next().value as Detection['httpAdapter']);
  return 'mixed';
}

function aggregateDatabases(apps: AppInfo[]): Database[] {
  const map = new Map<string, Database>();
  for (const app of apps) {
    for (const db of app.databases) {
      const key = `${db.kind}::${db.driver}::${db.orm ?? 'none'}`;
      if (!map.has(key)) {
        map.set(key, {
          kind: db.kind,
          driver: db.driver,
          orm: db.orm,
          apps: [],
          migrationDirs: [...db.migrationDirs.map((d) => (app.path === '.' ? d : `${app.path}/${d}`))],
        });
      }
      const entry = map.get(key)!;
      if (!entry.apps.includes(app.path)) entry.apps.push(app.path);
      for (const md of db.migrationDirs) {
        const full = app.path === '.' ? md : `${app.path}/${md}`;
        if (!entry.migrationDirs.includes(full)) entry.migrationDirs.push(full);
      }
    }
  }
  return [...map.values()];
}

function aggregateCommunication(apps: AppInfo[]): CommsChannel[] {
  const map = new Map<string, CommsChannel>();
  for (const app of apps) {
    for (const c of app.communication) {
      const key = `${c.kind}::${c.driver}`;
      if (!map.has(key)) {
        map.set(key, { kind: c.kind, driver: c.driver, apps: [] });
      }
      const entry = map.get(key)!;
      if (!entry.apps.includes(app.path)) entry.apps.push(app.path);
    }
  }
  return [...map.values()];
}

// ──────────────────────────────────────────────────────────
// Observed patterns — sample real files
// ──────────────────────────────────────────────────────────

function detectObservedPatterns(root: string, apps: AppInfo[]): ObservedPatterns {
  const samples: string[] = [];
  const maxSamples = 8;
  for (const app of apps) {
    if (samples.length >= maxSamples) break;
    if (!app.srcLayout.srcDir) continue;
    const appSrc =
      app.path === '.' ? join(root, app.srcLayout.srcDir) : join(root, app.path, app.srcLayout.srcDir);
    const found: string[] = [];
    findControllerFiles(appSrc, found, maxSamples - samples.length);
    samples.push(...found);
  }

  const notes: string[] = [];
  if (samples.length === 0) {
    return {
      sampledFiles: [],
      namingConvention: 'unknown',
      controllerFileLayout: 'unknown',
      dtoLocation: 'unknown',
      constructorInjection: 'unknown',
      notes: ['No controller files sampled — project may be empty or non-standard.'],
    };
  }

  // Naming convention — look at the feature-folder segment before the filename
  let kebab = 0;
  let camel = 0;
  for (const f of samples) {
    const base = basename(f).replace(/\.controller\.ts$/, '');
    if (/^[a-z]+(-[a-z0-9]+)*$/.test(base)) kebab++;
    else if (/^[a-z][a-zA-Z0-9]*$/.test(base) && /[A-Z]/.test(base)) camel++;
    else if (/^[a-z]+$/.test(base)) kebab++; // single word counts as kebab-ish
  }
  const namingConvention: ObservedPatterns['namingConvention'] =
    kebab > 0 && camel > 0 ? 'mixed' : kebab > 0 ? 'kebab-case' : camel > 0 ? 'camelCase' : 'unknown';

  // DTO location — look next to each controller for dto/ folder
  let coLocatedDto = 0;
  let centralDto = 0;
  for (const f of samples) {
    const dir = f.slice(0, f.lastIndexOf('/'));
    if (isDir(join(dir, 'dto'))) coLocatedDto++;
    else if (
      isDir(join(dir, '..', 'dto')) ||
      isDir(join(dir, '..', '..', 'dto'))
    )
      centralDto++;
  }
  const dtoLocation: ObservedPatterns['dtoLocation'] =
    coLocatedDto > 0 && centralDto === 0
      ? 'co-located'
      : centralDto > 0 && coLocatedDto === 0
      ? 'centralized'
      : coLocatedDto > 0 && centralDto > 0
      ? 'mixed'
      : 'unknown';

  // Controller grouping — one-per-feature means one controller per directory
  const dirSet = new Set(samples.map((f) => f.slice(0, f.lastIndexOf('/'))));
  const controllerFileLayout: ObservedPatterns['controllerFileLayout'] =
    dirSet.size === samples.length ? 'one-per-feature' : 'grouped';

  // Constructor injection — grep for `constructor(` and `@Inject(`
  let seenConstructor = 0;
  let seenInjectDecorator = 0;
  for (const f of samples) {
    const txt = readTextSafe(f) ?? '';
    if (/constructor\s*\(/.test(txt)) seenConstructor++;
    if (/@Inject\s*\(/.test(txt)) seenInjectDecorator++;
  }
  const constructorInjection: ObservedPatterns['constructorInjection'] =
    seenInjectDecorator === 0 && seenConstructor > 0
      ? 'standard'
      : seenInjectDecorator > 0
      ? 'mixed-with-@Inject'
      : 'unknown';

  notes.push(
    `${samples.length} controller file(s) sampled. Naming=${namingConvention}. DTO=${dtoLocation}. Layout=${controllerFileLayout}.`
  );

  return {
    sampledFiles: samples.map((f) => relative(root, f)),
    namingConvention,
    controllerFileLayout,
    dtoLocation,
    constructorInjection,
    notes,
  };
}

// ──────────────────────────────────────────────────────────
// Obsidian settings
// ──────────────────────────────────────────────────────────

function detectObsidian(root: string): Detection['obsidian'] {
  const settings = readJsonSafe(join(root, '.claude/settings.local.json')) as
    | { obsidianVaultPath?: string }
    | null;
  const vault = settings?.obsidianVaultPath ?? null;
  return { configured: vault !== null && vault.length > 0, vaultPath: vault };
}

// ──────────────────────────────────────────────────────────
// Build CLAUDE.md replacements
// ──────────────────────────────────────────────────────────

function buildClaudeMdReplacements(d: Partial<Detection>): Record<string, string> {
  const out: Record<string, string> = {};
  const pm = d.packageManager && d.packageManager !== 'unknown' ? d.packageManager : 'npm';

  // header
  const headerParts: string[] = [];
  if (d.monorepo?.isMonorepo) {
    headerParts.push(
      `This is a **NestJS monorepo** (${d.monorepo.tool ?? 'workspaces'}) on Node${d.nodeVersion ? ` ${d.nodeVersion}` : ''} using **${pm}**.`
    );
    headerParts.push(`Apps: ${d.monorepo.apps?.map((a) => a.name).join(', ') || '(none detected)'}`);
  } else {
    headerParts.push(
      `This is a NestJS project on Node${d.nodeVersion ? ` ${d.nodeVersion}` : ''} using **${pm}**` +
        (d.httpAdapter && d.httpAdapter !== 'unknown' && d.httpAdapter !== 'mixed'
          ? ` with the ${d.httpAdapter} HTTP adapter`
          : '') +
        '.'
    );
  }
  if (d.databases && d.databases.length > 0) {
    const kinds = d.databases.map((db) => db.kind).join(', ');
    headerParts.push(`Data stores: ${kinds}.`);
  }
  if (d.communication && d.communication.length > 0) {
    headerParts.push(
      `Inter-service comms: ${d.communication.map((c) => c.kind).join(', ')}.`
    );
  }
  headerParts.push(
    `Tests run with ${d.testFramework && d.testFramework !== 'unknown' ? d.testFramework : 'the configured test runner'}.`
  );
  out.header = headerParts.join('\n');

  // apps_overview (monorepo only)
  if (d.monorepo?.isMonorepo && d.monorepo.apps && d.monorepo.apps.length > 0) {
    const lines: string[] = [];
    for (const app of d.monorepo.apps) {
      const dbs = app.databases.map((x) => x.kind).join('+') || '—';
      const comms = app.communication.map((x) => x.kind).join('+') || '—';
      lines.push(
        `- **${app.name}** (\`${app.path}\`): ${app.isNestJS ? 'NestJS' : 'non-Nest'}, http=${app.httpAdapter}, db=${dbs}, comms=${comms}`
      );
    }
    out.apps_overview = lines.join('\n');
  }

  // databases
  if (d.databases && d.databases.length > 0) {
    const lines = d.databases.map((db) => {
      const apps = db.apps.length > 0 ? ` [used by: ${db.apps.join(', ')}]` : '';
      const migrations = db.migrationDirs.length > 0 ? ` migrations: \`${db.migrationDirs.join('\`, \`')}\`` : '';
      return `- **${db.kind}** via \`${db.driver}\`${db.orm && db.orm !== 'native' ? ` (ORM: ${db.orm})` : ' (raw driver)'}${apps}.${migrations}`;
    });
    out.databases = lines.join('\n');
  } else if (d.databases) {
    out.databases = '_No database detected._';
  }

  // communication
  if (d.communication && d.communication.length > 0) {
    const lines = d.communication.map(
      (c) => `- **${c.kind}** via \`${c.driver}\`${c.apps.length ? ` [${c.apps.join(', ')}]` : ''}`
    );
    out.communication = lines.join('\n');
  } else if (d.communication) {
    out.communication = '_No inter-service communication detected._';
  }

  // commands
  const s = d.scripts ?? null;
  const cmdLines: string[] = ['```bash'];
  cmdLines.push('# Dependencies');
  cmdLines.push(`${pm} install                  # install dependencies`);
  if (pm === 'yarn' || pm === 'pnpm' || pm === 'bun') {
    cmdLines.push(`${pm} add <name>               # add runtime dep`);
    cmdLines.push(`${pm} add -D <name>            # add dev dep`);
  } else {
    cmdLines.push(`${pm} install <name>           # add runtime dep`);
    cmdLines.push(`${pm} install -D <name>        # add dev dep`);
  }
  cmdLines.push('');
  cmdLines.push('# Build & type-check');
  cmdLines.push(
    s?.build
      ? `${pm} run ${s.build}                  # production build`
      : `${pm} run build                  # production build (script not detected)`
  );
  cmdLines.push(
    s?.typecheck
      ? `${pm} run ${s.typecheck}           # tsc --noEmit`
      : `npx tsc --noEmit             # pure type check`
  );
  cmdLines.push('');
  cmdLines.push('# Test');
  if (s?.test) cmdLines.push(`${pm} ${s.test === 'test' ? 'test' : 'run ' + s.test}                     # full suite`);
  if (s?.testE2E) cmdLines.push(`${pm} run ${s.testE2E}              # end-to-end suite`);
  cmdLines.push('');
  cmdLines.push('# Lint & format');
  if (s?.lint) cmdLines.push(`${pm} run ${s.lint}                   # lint`);
  if (s?.lintFix) cmdLines.push(`${pm} run ${s.lintFix}               # lint --fix`);
  if (s?.format) cmdLines.push(`${pm} run ${s.format}                 # format`);
  cmdLines.push('');
  cmdLines.push('# Dev server');
  cmdLines.push(
    s?.dev ? `${pm} run ${s.dev}               # dev server (watch mode)` : `${pm} run start:dev               # NestJS in watch mode`
  );
  if (d.databases && d.databases.some((x) => x.orm !== 'native' && x.orm !== null) && s?.migrate) {
    cmdLines.push('');
    cmdLines.push('# Database migrations');
    cmdLines.push(`${pm} run ${s.migrate}                # apply pending migrations`);
    if (s.migrateRollback) cmdLines.push(`${pm} run ${s.migrateRollback}       # rollback last`);
  }
  cmdLines.push('```');
  out.commands = cmdLines.filter((l) => l !== undefined).join('\n');

  // orm_dir — comma-separated migration dirs
  const migDirs = (d.databases ?? []).flatMap((x) => x.migrationDirs);
  if (migDirs.length > 0) {
    out.orm_dir = `${migDirs.join(' | ')}                — ORM schema & migrations (never hand-edit old ones)`;
  } else if (d.databases && d.databases.length === 0) {
    out.orm_dir = '<!-- no data stores detected — this project does not use a database layer -->';
  }

  // monorepo_commands — per-tool orchestration hints
  if (d.monorepo?.isMonorepo && d.monorepo.apps && d.monorepo.apps.length > 0) {
    const tool = d.monorepo.tool;
    const sampleApp = d.monorepo.apps.find((a) => a.path !== '.')?.name ?? '<app>';
    const lines: string[] = ['```bash'];
    if (tool === 'turbo') {
      lines.push(`# Turborepo — orchestrate across packages`);
      lines.push(`npx turbo run build                      # build all packages`);
      lines.push(`npx turbo run test --filter=${sampleApp}              # test one app`);
      lines.push(`npx turbo run lint --filter='...^${sampleApp}'           # include upstream deps`);
    } else if (tool === 'nx') {
      lines.push(`# Nx — per-project targets`);
      lines.push(`npx nx run-many -t build                  # build all`);
      lines.push(`npx nx test ${sampleApp}                       # test one app`);
      lines.push(`npx nx affected -t test --base=main         # only changed projects`);
    } else if (tool === 'pnpm') {
      lines.push(`# pnpm workspaces`);
      lines.push(`pnpm -r build                             # build all workspaces`);
      lines.push(`pnpm --filter ${sampleApp} test                 # test one app`);
      lines.push(`pnpm --filter ${sampleApp}... build              # build one app + its deps`);
    } else if (tool === 'yarn') {
      lines.push(`# Yarn workspaces`);
      lines.push(`yarn workspaces foreach -A run build      # build all`);
      lines.push(`yarn workspace ${sampleApp} test               # test one app`);
    } else if (tool === 'bun') {
      lines.push(`# Bun workspaces`);
      lines.push(`bun run --filter '*' build                # build all (bun 1.1+)`);
      lines.push(`bun run --filter ${sampleApp} test              # test one app`);
    }
    lines.push('```');
    out.monorepo_commands = lines.join('\n');
  } else {
    out.monorepo_commands = '<!-- not a monorepo — single package layout -->';
  }

  // apps_overview default for single-app
  if (!d.monorepo?.isMonorepo) {
    out.apps_overview = '<!-- single-app repo — no workspace breakdown -->';
  }

  // observed_patterns
  if (d.observedPatterns && d.observedPatterns.sampledFiles.length > 0) {
    const p = d.observedPatterns;
    out.observed_patterns = [
      `- Naming convention: **${p.namingConvention}**`,
      `- DTO location: **${p.dtoLocation}**`,
      `- Controller layout: **${p.controllerFileLayout}**`,
      `- Injection style: **${p.constructorInjection}**`,
      `- Sampled files: ${p.sampledFiles.slice(0, 5).map((f) => `\`${f}\``).join(', ')}${p.sampledFiles.length > 5 ? ` (+${p.sampledFiles.length - 5} more)` : ''}`,
    ].join('\n');
  }

  return out;
}

// ──────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────

function parseArgs(args: string[]): { root: string; pretty: boolean } {
  let root = process.cwd();
  let pretty = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--root' && args[i + 1]) {
      root = resolve(args[++i]!);
    } else if (a === '--pretty') {
      pretty = true;
    } else if (a === '--help' || a === '-h') {
      console.error('Usage: tsx detect.ts [--root <dir>] [--pretty]');
      exit(0);
    }
  }
  return { root, pretty };
}

function main() {
  const { root, pretty } = parseArgs(argv.slice(2));
  const warnings: string[] = [];
  const errors: string[] = [];

  const rootPkg = readJsonSafe(join(root, 'package.json')) as PkgJson | null;

  if (!rootPkg) {
    errors.push(`No package.json at ${join(root, 'package.json')}`);
    const out: Partial<Detection> = {
      schemaVersion: 2,
      projectRoot: root,
      scannedAt: new Date().toISOString(),
      errors,
      warnings,
    };
    stdout.write(pretty ? JSON.stringify(out, null, 2) : JSON.stringify(out));
    stdout.write('\n');
    exit(1);
  }

  // Stage 1: monorepo + apps
  const monorepo = detectMonorepo(root, rootPkg, warnings);
  const apps = enumerateApps(root, rootPkg, monorepo, warnings);

  // Stage 2: aggregate facts across apps
  const allPkgs: PkgJson[] = [rootPkg];
  for (const app of apps) {
    if (app.path === '.') continue;
    const pkg = readJsonSafe(join(root, app.path, 'package.json')) as PkgJson | null;
    if (pkg) allPkgs.push(pkg);
  }

  const isNestJS = apps.some((a) => a.isNestJS);
  const nestVersion = apps.map((a) => a.nestVersion).find((v) => v !== null) ?? null;

  if (!isNestJS) {
    warnings.push(
      'This project does not appear to be NestJS in any workspace. The template is tuned for NestJS and may not fit.'
    );
  }

  const packageManager = detectPackageManager(root);
  if (packageManager === 'unknown') {
    warnings.push('No lockfile detected. Falling back to npm — run install once to generate one.');
  }

  const nodeVersion = detectNodeVersion(root, rootPkg);
  const httpAdapter = aggregateHttpAdapter(apps);
  const testFramework = detectTestFramework(allPkgs, rootPkg);
  const linter = detectLinter(allPkgs, root);
  const formatter = detectFormatter(allPkgs, root);
  const databases = aggregateDatabases(apps);
  const communication = aggregateCommunication(apps);
  const scripts = detectScripts(rootPkg);
  const obsidian = detectObsidian(root);

  const hasConfig = allPkgs.some((p) => hasDep(p, '@nestjs/config'));
  const hasSwagger = allPkgs.some((p) => hasDep(p, '@nestjs/swagger'));
  const hasObservability = {
    pino: allPkgs.some((p) => hasDep(p, 'pino') || hasDep(p, 'nestjs-pino')),
    winston: allPkgs.some((p) => hasDep(p, 'winston') || hasDep(p, 'nest-winston')),
  };

  // Stage 3: observed patterns
  const observedPatterns = detectObservedPatterns(root, apps);

  // Rule path rewrites
  const recommendedRulePathRewrites: Detection['recommendedRulePathRewrites'] = [];
  if (monorepo.isMonorepo) {
    const appControllerGlobs: string[] = [];
    const appGuardGlobs: string[] = [];
    const appEntityGlobs: string[] = [];
    for (const app of apps) {
      if (!app.srcLayout.srcDir) continue;
      const base = app.path === '.' ? app.srcLayout.srcDir : `${app.path}/${app.srcLayout.srcDir}`;
      appControllerGlobs.push(`${base}/**/*.controller.ts`);
      appGuardGlobs.push(`${base}/**/*.guard.ts`);
      appEntityGlobs.push(`${base}/**/*.entity.ts`);
    }
    if (appControllerGlobs.length > 0) {
      recommendedRulePathRewrites.push({
        file: 'rules/api.md',
        addPaths: appControllerGlobs,
        removePaths: [],
      });
      recommendedRulePathRewrites.push({
        file: 'rules/security.md',
        addPaths: [...appControllerGlobs, ...appGuardGlobs],
        removePaths: [],
      });
      if (databases.some((d) => d.orm && d.orm !== 'native')) {
        recommendedRulePathRewrites.push({
          file: 'rules/database.md',
          addPaths: appEntityGlobs,
          removePaths: [],
        });
      }
    }
    warnings.push('Monorepo detected. Rule paths extended to cover each workspace app.');
  }

  // Recommended deletions — only remove database.md when NO database at all
  const recommendedDeletes: string[] = [];
  if (databases.length === 0) {
    recommendedDeletes.push('.claude/rules/database.md');
  }

  // Aggregated srcLayout (for single-app back-compat; in monorepo it's of the first app)
  const firstApp = apps[0];
  const srcLayout: AppInfo['srcLayout'] = firstApp?.srcLayout ?? {
    srcDir: null,
    hasMainTs: false,
    hasAppModule: false,
    hasModulesFolder: false,
    controllerGlob: null,
  };
  if (!monorepo.isMonorepo && !srcLayout.srcDir) {
    warnings.push('No src/ directory found. NestJS rules are scoped to src/** and will not fire.');
  }

  // Build replacements
  const partialForReplacements: Partial<Detection> = {
    packageManager,
    nodeVersion,
    httpAdapter,
    testFramework,
    databases,
    communication,
    scripts,
    monorepo: { isMonorepo: monorepo.isMonorepo, tool: monorepo.tool, workspaces: monorepo.workspaces, apps },
    observedPatterns,
  };
  const claudeMdReplacements = buildClaudeMdReplacements(partialForReplacements);

  const detection: Detection = {
    schemaVersion: 2,
    projectRoot: root,
    scannedAt: new Date().toISOString(),
    isNestJS,
    nestVersion,
    packageManager,
    nodeVersion,
    httpAdapter,
    testFramework,
    linter,
    formatter,
    databases,
    communication,
    hasConfig,
    hasSwagger,
    hasObservability,
    scripts,
    monorepo: {
      isMonorepo: monorepo.isMonorepo,
      tool: monorepo.tool,
      workspaces: monorepo.workspaces,
      apps,
    },
    srcLayout,
    observedPatterns,
    obsidian,
    claudeMdReplacements,
    recommendedRulePathRewrites,
    recommendedDeletes,
    warnings,
    errors,
  };

  stdout.write(pretty ? JSON.stringify(detection, null, 2) : JSON.stringify(detection));
  stdout.write('\n');
  exit(errors.length > 0 ? 1 : 0);
}

main();
