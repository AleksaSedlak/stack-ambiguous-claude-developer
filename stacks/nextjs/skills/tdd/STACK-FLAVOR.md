## Signature Examples

Write the type signature and interface first, then write the test, then implement.

### Pure function

```tsx
// 1. Define the signature
export function formatCurrency(amount: number, currency: string): string;

// 2. Write the test
it('formats USD with two decimals', () => {
  expect(formatCurrency(1234.5, 'USD')).toBe('$1,234.50');
});

// 3. Implement to make the test pass
```

### React component with Props

```tsx
// 1. Define the props interface and component signature
interface UserCardProps {
  user: { id: string; name: string; avatarUrl: string | null };
  onFollow: (userId: string) => void;
}

export function UserCard(props: UserCardProps): React.ReactElement;

// 2. Write the test
it('calls onFollow with user id when follow button is clicked', async () => {
  const onFollow = vi.fn();
  const user = userEvent.setup();
  render(<UserCard user={{ id: '1', name: 'Alice', avatarUrl: null }} onFollow={onFollow} />);
  await user.click(screen.getByRole('button', { name: /follow/i }));
  expect(onFollow).toHaveBeenCalledWith('1');
});

// 3. Implement the component
```

### Server Action

```tsx
// 1. Define the signature with input/output types
interface CreatePostInput {
  title: string;
  body: string;
  tags: string[];
}

interface CreatePostResult {
  success: boolean;
  post?: { id: string; slug: string };
  error?: string;
}

export async function createPost(input: CreatePostInput): Promise<CreatePostResult>;

// 2. Write the test
it('returns the created post with a generated slug', async () => {
  const result = await createPost({ title: 'Hello World', body: 'Content', tags: ['intro'] });
  expect(result.success).toBe(true);
  expect(result.post?.slug).toBe('hello-world');
});

// 3. Implement
```

### Route Handler

```tsx
// 1. Define the expected request/response shape
// GET /api/search?q=term → { results: Array<{ id: string; title: string; score: number }> }

export async function GET(request: NextRequest): Promise<NextResponse>;

// 2. Write the test
it('returns matching results for a valid query', async () => {
  const req = new NextRequest('http://localhost/api/search?q=next');
  const res = await GET(req);
  const body = await res.json();
  expect(res.status).toBe(200);
  expect(body.results.length).toBeGreaterThan(0);
  expect(body.results[0]).toHaveProperty('score');
});
```

## Validation Libraries

- **Zod** — the most common validation library in the Next.js ecosystem. Use at every boundary: form inputs, API request bodies, Server Action arguments, environment variables (`t3-env` wraps Zod). Parse with `schema.parse(data)` (throws) or `schema.safeParse(data)` (returns `{ success, data, error }`).

```tsx
import { z } from 'zod';

const CreatePostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  tags: z.array(z.string()).max(5).default([]),
});

type CreatePostInput = z.infer<typeof CreatePostSchema>;
```

- **Valibot** — tree-shakeable alternative to Zod with a similar API but smaller bundle size. Good choice when client-side validation bundle size matters.

- **next-safe-action** — type-safe Server Actions with built-in Zod validation, error handling, and middleware. Wraps `'use server'` functions with schema validation so you never handle raw `FormData` manually.

```tsx
import { actionClient } from '@/lib/safe-action';

export const createPost = actionClient
  .schema(CreatePostSchema)
  .action(async ({ parsedInput }) => {
    // parsedInput is fully typed and validated
    const post = await db.post.create({ data: parsedInput });
    return { post };
  });
```
