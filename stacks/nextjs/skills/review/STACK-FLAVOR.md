## Verification Commands

```bash
# Type-check
npx tsc --noEmit

# Lint (Next.js-aware)
npx next lint                   # or: npx eslint . --ext .ts,.tsx

# Format check
npx prettier --check .

# Tests
npx vitest run                  # or: npx jest --passWithNoTests

# Full production build — the definitive check
npm run build
```

## Stack-Specific Review Patterns

- **`'use client'` only where needed** — do not add `'use client'` to every component. Only add it at the boundary where hooks or browser APIs are first used. Child components of a Client Component are automatically client-rendered. Over-using `'use client'` pushes code out of the server bundle unnecessarily, increasing client JS size.

- **No hooks in Server Components** — Server Components must not use `useState`, `useEffect`, `useReducer`, `useContext`, or any custom hook that wraps them. If you see these in a component without `'use client'`, it will crash at runtime.

- **No secrets in client code** — environment variables without the `NEXT_PUBLIC_` prefix are server-only. Variables with `NEXT_PUBLIC_` are inlined into the client bundle at build time and visible to anyone. Review for: API keys, database URLs, auth secrets accidentally prefixed with `NEXT_PUBLIC_`. Check both `.env*` files and direct `process.env` access.

- **Error and loading boundaries** — every route group should have an `error.tsx` (catches runtime errors, shows fallback UI) and `loading.tsx` (shows during async data fetching). Missing these results in full-page crashes or no loading feedback. `error.tsx` must be a Client Component (`'use client'`).

- **Metadata exports** — `page.tsx` and `layout.tsx` files should export `metadata` (static) or `generateMetadata` (dynamic) for SEO. Check that titles, descriptions, and Open Graph data are set for public-facing pages.

- **Image optimization** — use `next/image` instead of raw `<img>` tags. Check for: missing `width`/`height` or `fill` prop, external domains not in `images.remotePatterns`, unnecessary `unoptimized` prop, missing `alt` text (accessibility).

- **Static route generation** — pages with dynamic segments (`[slug]`) that can be statically generated should export `generateStaticParams`. Without it, these pages render on-demand at request time, which is slower and more expensive.

- **No `any` types** — reject `any` in application code. Use `unknown` with type narrowing instead. The only acceptable `any` is in third-party type declaration shims with an inline justification comment.

- **Proper data fetching patterns** — `fetch()` in Server Components should use appropriate `cache` and `next.revalidate` options. Check for: fetching in Client Components when it could be a Server Component, missing error handling on fetch calls, not using `notFound()` for missing resources.

- **Route handler method exports** — `app/api/*/route.ts` files should only export named HTTP method functions (`GET`, `POST`, `PUT`, `DELETE`, `PATCH`). Exporting a default function or misspelling the method name silently fails.
