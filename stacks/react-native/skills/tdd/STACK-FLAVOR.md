## Signature Examples

### Component props

```tsx
interface UserCardProps {
  user: { id: string; name: string; avatarUrl: string };
  onPress: (userId: string) => void;
  testID?: string;
}

export function UserCard({ user, onPress, testID }: UserCardProps): React.ReactElement {
  // implementation
}
```

### Custom hook return type

```tsx
interface UseAuthReturn {
  user: User | null;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
}

export function useAuth(): UseAuthReturn {
  // implementation
}
```

### Navigation screen params

```tsx
type RootStackParamList = {
  Home: undefined;
  Profile: { userId: string };
  Settings: { section?: 'account' | 'notifications' };
};

type ProfileScreenProps = NativeStackScreenProps<RootStackParamList, 'Profile'>;
```

Write the type signature and props interface first, then write a failing test against that interface, then implement.

## Validation Libraries

- **Zod** — runtime schema validation at API boundaries, form inputs, and async storage reads. Pairs well with React Hook Form via `@hookform/resolvers/zod`.
- **Yup** — common in React Native projects using Formik for forms. Use `yup.object().shape({...})` for form validation schemas.
- **TypeScript strict mode** — `strict: true` in `tsconfig.json` with `noUncheckedIndexedAccess` catches type-level issues at compile time. Use as the first line of defense before runtime validation.
