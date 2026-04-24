---
paths:
  - "src/components/**"
  - "src/pages/**"
  - "src/app/**"
  - "app/**"
  - "pages/**"
  - "components/**"
  - "**/*.tsx"
  - "**/*.jsx"
---

# Frontend (React / Next.js)

## Component Structure

Each component has one responsibility. If a single component file is > ~150 lines or has
multiple `useEffect`s coordinating disjoint concerns, split it.

Order within a component file:

1. Imports
2. Types (props, local state shapes)
3. Schema (if the component owns form validation)
4. Sub-components used only here
5. The main component — default or named export
6. Styles (if colocated)

```tsx
type Props = { userId: string; onSave: (user: User) => void };

export function UserEditForm({ userId, onSave }: Props): JSX.Element {
  // 1. hooks — in a stable order
  const { data: user, isLoading } = useUser(userId);
  const [draft, setDraft] = useState<Partial<User>>({});

  // 2. derived values
  const isDirty = Object.keys(draft).length > 0;

  // 3. handlers
  const handleSave = useCallback(async () => {
    const saved = await saveUser({ ...user, ...draft });
    onSave(saved);
  }, [user, draft, onSave]);

  // 4. early returns
  if (isLoading) return <Spinner />;
  if (!user) return <NotFound />;

  // 5. main render
  return (/* ... */);
}
```

## Hooks

- Hooks at the top, in the same order on every render. Never conditional.
- Custom hooks start with `use`. They can call other hooks; they are not components.
- `useEffect` should be rare. Most "effects" are either:
  - Data derived from props/state → compute it inline or with `useMemo`
  - Event handling → put it in the event handler, not in an effect
  - Subscriptions → yes, legitimate use (eventSource, WebSocket, intervals, DOM listeners)
- Every effect that sets up a subscription returns a cleanup function. No exceptions.
- Effect dependency arrays must list every external value used. Disabling the eslint rule
  is almost always hiding a bug.

## State Management

- Local state: `useState` / `useReducer`.
- Shared state for a few components: lift it up, or pass through Context.
- Server state: use a query library (React Query, SWR, RTK Query). Don't `useEffect +
  fetch + useState` — you'll reinvent caching poorly.
- Global UI state (theme, modals, toasts): dedicated store (Zustand, Jotai, Redux
  Toolkit). Keep it small.
- Never store **derived** state. If B can be computed from A, don't store B.

## Server Components (Next.js App Router)

- Default to Server Components. Add `'use client'` only when you need state, effects, or
  browser-only APIs.
- Keep `'use client'` boundaries as deep in the tree as possible — a parent Server
  Component can pass a Client Component as a child.
- Server Components can `await` directly — no `useEffect` for data fetching.
- Don't pass non-serializable props (functions, class instances, Dates as-is) from Server
  to Client Components — serialize at the boundary.

## Data Fetching

- Client-side: React Query / SWR with explicit `queryKey` / `key`. Invalidate on mutation.
- Server-side (Next): `fetch` in Server Components or Route Handlers, with explicit
  `cache:` and `next: { revalidate, tags }` options.
- Loading and error states are first-class UI. Every data-fetching boundary has both.
- Don't `await` in a loop. `Promise.all` for independent requests.

## Forms

- Use a form library for anything nontrivial (React Hook Form, TanStack Form, Formik).
- Validate with the same schema the API uses (share Zod schemas between client and
  server when possible).
- Disable the submit button while submitting. Show inline field errors, not a toast.
- Submit handlers are `async` and return a discriminated success/error — don't swallow.

## Accessibility

- Semantic HTML first. `<button>` for clicks, `<a>` for navigation, `<form>` for forms.
- Every form input has a `<label>` with `htmlFor` (or wraps the input).
- Every interactive element is keyboard-accessible. If you use `<div onClick>`, you're
  building an inaccessible button — use `<button>`.
- `aria-live` for regions that update asynchronously (toasts, search results).
- Color contrast ≥ 4.5:1 for text. Never rely on color alone to convey meaning.
- Focus management: after navigation or modal open, focus a meaningful element.

## Performance

- Memoization (`useMemo`, `useCallback`, `React.memo`) is the last step, not the first.
  Most components don't need it. Profile before adding.
- Lists: stable keys that are not the array index. Virtualize lists > a few hundred rows.
- Images: `next/image` (Next) or `loading="lazy" decoding="async"` on `<img>`. Size them.
- Code-split large client-only components with `next/dynamic` or `React.lazy`.

## Safety in JSX

- `dangerouslySetInnerHTML` on user input is XSS unless sanitized. Use DOMPurify.
- External links: `<a target="_blank" rel="noopener noreferrer">`.
- URLs from user input: validate protocol before rendering as `href` —
  `javascript:alert(1)` is a thing.

## Testing

- Render + interact with Testing Library. Query by role, label, text — not by test IDs
  unless unavoidable.
- Don't test implementation (state values, hook internals). Test behavior ("clicking
  Save sends the update").
- Mock the network with MSW. Don't mock `fetch` directly.
