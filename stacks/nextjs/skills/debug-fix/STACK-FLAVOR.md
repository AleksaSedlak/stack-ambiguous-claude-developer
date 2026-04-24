## Reproduction Tools

- `npm run dev` — start the Next.js dev server with HMR and Fast Refresh; most bugs are reproducible here
- `npm run build && npm start` — build and serve the production bundle; use this when the bug only appears in production (e.g., static generation issues, middleware behavior, optimized image loading)
- `npx ts-node --esm script.ts` or `npx tsx script.ts` — run an isolated TypeScript script outside Next.js to narrow whether the issue is framework-related or pure logic
- Browser DevTools: Network tab for failed fetches/RSC payloads, Console for hydration warnings, Application tab for cookies/localStorage
- React DevTools: Components tab to inspect Server vs Client component tree, Profiler to spot unnecessary re-renders

## Environment Checks

- **Node version**: check `node -v` matches the project's `.nvmrc` or `engines` field in `package.json`; Next.js 14+ requires Node 18.17+
- **Package manager**: confirm which is in use (`package-lock.json` = npm, `pnpm-lock.yaml` = pnpm, `yarn.lock` = yarn, `bun.lockb` = bun); mixing causes phantom dependency issues
- **Clear caches when stuck**:
  - `rm -rf .next` — Next.js build cache (stale RSC bundles, bad manifests)
  - `rm -rf node_modules/.cache` — Babel/Webpack/Turbopack cache
  - `rm -rf node_modules && npm install` — full dependency reset
- **Environment files**: Next.js loads `.env.local` > `.env.development` > `.env` in dev; `.env.local` > `.env.production` > `.env` in prod; `NEXT_PUBLIC_` prefix exposes vars to the client bundle — missing the prefix is a silent failure
- **TypeScript config**: check `tsconfig.json` includes `"moduleResolution": "bundler"` (or `"node"`) and that `paths` aliases match `next.config.js` webpack alias config

## Common Bug Patterns

- **Hydration mismatch** — browser console shows "Text content did not match" or "Hydration failed because the initial UI does not match what was rendered on the server." Root cause: server renders different HTML than client. Common triggers: `Date.now()`, `Math.random()`, `typeof window !== 'undefined'` branching, `useLayoutEffect` in SSR. Fix: use `useEffect` + state for client-only values, or wrap in `<Suspense>` with a client-only fallback.

- **Missing 'use client' directive** — error like "You're importing a component that needs useState" or "createContext is not a function." Root cause: a component uses hooks (`useState`, `useEffect`, `useContext`) or browser APIs but is treated as a Server Component. Fix: add `'use client'` as the first line of the file. Only add it at the boundary — child components of a Client Component are automatically client.

- **Server Action failures** — "Could not find the module" or action silently does nothing. Root cause: missing `'use server'` directive at the top of the file or inline in the function, or the action returns a non-serializable value (class instances, functions, Dates). Fix: ensure `'use server'` is declared, return only plain objects, and use `revalidatePath`/`revalidateTag` to refresh data after mutation.

- **useEffect for derived state** — component flickers or renders stale data because a value is computed inside `useEffect` + `setState` instead of during render. Root cause: treating `useEffect` as a "computed property." Fix: compute derived values directly in the render body or use `useMemo` if the computation is expensive.

- **Stale closures in hooks** — `useEffect` or `useCallback` captures an old value of a prop or state variable. Root cause: missing or incorrect dependency array. Fix: add the variable to the deps array, or use a ref for values that should not trigger re-runs. The `react-hooks/exhaustive-deps` ESLint rule catches this — do not disable it.

- **Unstable `key` prop** — list items reorder incorrectly, input state jumps between rows, or animations break. Root cause: using array index as `key` on a list that can be reordered, filtered, or appended. Fix: use a stable unique identifier (database ID, slug, UUID).

- **next/image misconfiguration** — images don't load, show 400 errors, or are not optimized. Root cause: missing `width`/`height` or `fill` prop, external domain not listed in `next.config.js` `images.remotePatterns`, or using `unoptimized` unnecessarily. Fix: provide dimensions, add the domain to remote patterns, and remove `unoptimized` unless you have a specific reason.

- **Middleware redirect loops** — page keeps redirecting to itself or returns a 308 loop. Root cause: middleware matches its own redirect target (e.g., redirecting `/login` to `/login` based on a missing cookie that is also missing on the redirected request). Fix: add a `matcher` config to exclude the redirect target, or check `request.nextUrl.pathname` to skip already-redirected paths.

## Verification Commands

```bash
npx tsc --noEmit                # type-check without emitting files
npx next lint                   # Next.js-aware ESLint (or npx eslint .)
npx prettier --check .          # formatting check (non-destructive)
npx vitest run                  # run tests once (or npx jest --passWithNoTests)
npm run build                   # full production build — catches SSR errors, bad imports, missing 'use client'
```
