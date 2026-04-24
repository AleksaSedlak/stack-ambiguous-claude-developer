## Verification Commands

```bash
npx tsc --noEmit              # type-check without emitting
npx eslint .                  # lint the entire project
npx jest                      # run the full test suite
npx react-native run-ios      # build iOS to catch native linking issues
npx react-native run-android  # build Android to catch Gradle/native issues
```

## Stack-Specific Review Patterns

- **Platform.select / Platform.OS for cross-platform code** — any component or utility that behaves differently on iOS vs Android must use `Platform.select()` or `Platform.OS` checks. Avoid hardcoding assumptions about one platform.
- **No inline styles in frequently re-rendered components** — use `StyleSheet.create()` outside the component body. Inline style objects are re-created every render, causing unnecessary native bridge traffic.
- **FlatList/SectionList instead of ScrollView for large lists** — `ScrollView` renders all children at once. For lists with more than ~20 items, always use `FlatList` or `SectionList` for virtualized rendering.
- **Proper Animated API usage** — use `useNativeDriver: true` wherever possible (transforms, opacity). Native driver offloads animation to the UI thread and avoids JS thread jank. It does not support layout properties (width, height, padding).
- **No secrets in JS bundle** — never hardcode API keys, tokens, or secrets in JavaScript source. Use `react-native-config` (.env files) or `expo-constants` (app.json extra). The JS bundle is extractable from production builds.
- **Check for memory leaks** — event listeners, subscriptions, and timers set up in `useEffect` must be cleaned up in the return function. Common offenders: `AppState.addEventListener`, `Keyboard.addListener`, `BackHandler.addEventListener`, WebSocket connections.
- **Accessibility** — interactive elements (buttons, links, pressables) must have `accessibilityLabel` and `accessibilityRole`. Ensure `accessibilityState` is set for toggles and disabled states. Test with VoiceOver (iOS) and TalkBack (Android).
