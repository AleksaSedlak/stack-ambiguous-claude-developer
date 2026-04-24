## Framework Detection

- **Vitest**: look for `vitest.config.ts` or `vite.config.ts` with test block, `vitest` in devDependencies, test files using `import { describe, it, expect } from 'vitest'`
- **Jest**: look for `jest.config.ts`/`jest.config.js`, `next/jest` import in config, `jest` or `@jest/globals` in devDependencies, `"test": "jest"` in package.json scripts
- **React Testing Library**: `@testing-library/react` in devDependencies, imports of `render`, `screen`, `fireEvent` from `@testing-library/react`
- **Playwright**: `playwright.config.ts`, `@playwright/test` in devDependencies, `tests/` or `e2e/` directory with `.spec.ts` files
- **Cypress**: `cypress.config.ts`, `cypress/` directory, `cypress` in devDependencies
- **File naming**: `*.test.ts(x)` or `*.spec.ts(x)` — check existing tests to match the project convention

## Framework-Specific Test Patterns

### Server Components

Server Components are async functions that return JSX. Test them by calling `render()` from React Testing Library, but note they cannot use hooks. For components that fetch data, mock the data-fetching functions.

```tsx
import { render, screen } from '@testing-library/react';
import { UserProfile } from './user-profile';

// Mock the data layer, not fetch itself
vi.mock('@/lib/db', () => ({
  getUser: vi.fn().mockResolvedValue({ id: '1', name: 'Alice' }),
}));

it('renders user name', async () => {
  // Server Components are async — resolve before asserting
  const Component = await UserProfile({ userId: '1' });
  render(Component);
  expect(screen.getByText('Alice')).toBeInTheDocument();
});
```

### Client Components

Standard React Testing Library patterns apply. Use `userEvent` over `fireEvent` for realistic interaction simulation.

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Counter } from './counter';

it('increments count on click', async () => {
  const user = userEvent.setup();
  render(<Counter initialCount={0} />);
  await user.click(screen.getByRole('button', { name: /increment/i }));
  expect(screen.getByText('1')).toBeInTheDocument();
});
```

### Route Handlers (app/api)

Test by importing the handler function directly and passing a mock `NextRequest`. Assert on the returned `NextResponse`.

```tsx
import { GET } from '@/app/api/users/route';
import { NextRequest } from 'next/server';

it('returns users list', async () => {
  const req = new NextRequest('http://localhost:3000/api/users');
  const res = await GET(req);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.users).toHaveLength(3);
});
```

### Server Actions

Test as regular async functions. They accept `FormData` or plain arguments and return serializable data.

```tsx
import { createTodo } from '@/app/actions/todo';

it('creates a todo and returns it', async () => {
  const formData = new FormData();
  formData.set('title', 'Write tests');
  const result = await createTodo(formData);
  expect(result.title).toBe('Write tests');
  expect(result.id).toBeDefined();
});
```

### Middleware

Test by constructing a `NextRequest` and calling the middleware function. Assert on redirects, rewrites, or header modifications.

```tsx
import { middleware } from '@/middleware';
import { NextRequest } from 'next/server';

it('redirects unauthenticated users to /login', () => {
  const req = new NextRequest('http://localhost:3000/dashboard');
  const res = middleware(req);
  expect(res.status).toBe(307);
  expect(res.headers.get('location')).toContain('/login');
});
```

### Data Fetching

Mock at the boundary: either mock the database/ORM layer or use MSW to intercept HTTP requests to external APIs.

```tsx
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

const server = setupServer(
  http.get('https://api.example.com/posts', () => {
    return HttpResponse.json([{ id: 1, title: 'Test Post' }]);
  }),
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

## Mocking Tools

- **`vi.mock` / `jest.mock`** — module-level mocking for internal dependencies (database clients, config, third-party SDKs). Place at the top of the test file. Use `vi.fn()` / `jest.fn()` for individual function spies.
- **MSW (Mock Service Worker)** — intercept outgoing HTTP requests at the network level. Preferred for mocking external APIs because it exercises the real fetch/axios code path. Works in both Node (tests) and browser (Storybook/dev).
- **`next/jest`** — Jest transformer that handles Next.js-specific module resolution (`@/` aliases, CSS modules, image imports). Configure in `jest.config.ts` via `createJestConfig` from `next/jest`.
- **`@testing-library/jest-dom`** — custom matchers like `toBeInTheDocument()`, `toHaveTextContent()`, `toBeVisible()`. Import in test setup file.
- **Database mocking** — mock the Prisma client or Drizzle query builder at the module level rather than spinning up a test database for unit tests. Use a real test database only for integration tests.
