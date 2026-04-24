## Framework Detection

- **Jest** (default) — `jest.config.js` or `"jest"` key in `package.json`; standard test runner shipped with React Native
- **jest-expo** — `jest-expo` in devDependencies; Expo-specific Jest preset (`"preset": "jest-expo"`)
- **@testing-library/react-native** — `@testing-library/react-native` in devDependencies; provides `render`, `screen`, `fireEvent` for component testing
- **Detox** — `.detoxrc.js` or `detox` key in `package.json`; end-to-end testing on real simulators/emulators
- **Maestro** — `.maestro/` directory with YAML flow files; declarative mobile E2E testing
- File naming: `*.test.tsx`, `*.spec.tsx`, or files under `__tests__/`

## Framework-Specific Test Patterns

### Component tests (@testing-library/react-native)

```tsx
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MyButton } from './MyButton';

test('calls onPress when tapped', () => {
  const onPress = jest.fn();
  render(<MyButton title="Tap me" onPress={onPress} />);
  fireEvent.press(screen.getByText('Tap me'));
  expect(onPress).toHaveBeenCalledTimes(1);
});
```

### Navigation tests

```tsx
import { NavigationContainer } from '@react-navigation/native';

const wrapper = ({ children }) => (
  <NavigationContainer>{children}</NavigationContainer>
);
render(<MyScreen />, { wrapper });
```

Alternatively, mock `@react-navigation/native` with `jest.mock` to isolate screen logic from navigation.

### Native module mocks

```ts
jest.mock('react-native/Libraries/Animated/NativeAnimatedHelper');
jest.mock('react-native/Libraries/EventEmitter/NativeEventEmitter');
```

Place shared native module mocks in `jest.setup.js` (referenced by `setupFiles` in Jest config).

### Async storage mocks

```ts
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);
```

### Platform-specific testing

```ts
jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'android',
  select: jest.fn((obj) => obj.android),
}));
```

Test both iOS and Android code paths by switching `Platform.OS` in separate test files or describe blocks.

## Mocking Tools

- **jest.mock** — mock native modules, navigation, async storage, and any module boundary
- **@testing-library/react-native** — `render`, `screen`, `fireEvent`, `waitFor` for component interaction testing
- **MSW (Mock Service Worker)** — intercept HTTP requests in tests for API layer testing
- **jest.fn() / jest.spyOn()** — mock callbacks, spy on method calls
- **jest.useFakeTimers()** — control `setTimeout`, `setInterval`, `Animated` timing in tests
