## Reproduction Tools

- `npx expo start` — start Expo dev server (Expo projects)
- `npx react-native run-ios` — build and run on iOS simulator
- `npx react-native run-android` — build and run on Android emulator
- Flipper / React Native Debugger — inspect component tree, network, async storage
- Metro bundler logs — watch terminal output for JS errors and warnings
- `adb logcat` — view native Android logs (crash traces, native module errors)
- `Console.app` or Xcode console — view native iOS logs

## Environment Checks

- Node version: `node -v` (check `.nvmrc` or `engines` in `package.json`)
- Xcode version: `xcodebuild -version` (iOS builds require matching Xcode)
- Android SDK: verify `ANDROID_HOME` is set and `adb devices` lists the target
- CocoaPods: `pod --version` and `cd ios && pod install` after native dep changes
- Ruby version: `ruby -v` (CocoaPods depends on Ruby; mismatches break iOS builds)
- Metro cache: `npx react-native start --reset-cache` to clear stale bundles
- Watchman: `watchman watch-del-all` when file-watching stops picking up changes
- Gradle cache: `cd android && ./gradlew clean` when Android builds use stale artifacts

## Common Bug Patterns

- **Metro bundler cache** — app shows old code or crashes after adding/removing a dependency. Root cause: Metro cached the old dependency graph. Fix: `npx react-native start --reset-cache`.
- **Native module linking** — `NativeModule.X is null` or `TurboModuleRegistry` error after installing a native module. Root cause: module installed in JS but not linked to native projects. Fix: `npx pod-install` (iOS) and rebuild both platforms.
- **Platform-specific crashes** — code works on iOS but crashes on Android (or vice versa). Root cause: a component or API behaves differently across platforms. Fix: check `Platform.OS` conditionals, use `Platform.select()`, and test on both platforms.
- **Hermes vs JSC differences** — unexpected runtime errors with `BigInt`, `Intl`, `eval`, or Proxy. Root cause: Hermes does not support the full JSC/V8 feature set. Fix: check `global.HermesInternal` to detect the engine; use polyfills or avoid unsupported APIs.
- **Keyboard avoidance** — content hidden behind keyboard or layout jumps. Root cause: `KeyboardAvoidingView` uses `behavior="padding"` on Android where `"height"` is needed (or vice versa). Fix: set `behavior={Platform.OS === 'ios' ? 'padding' : 'height'}`.
- **FlatList performance** — list scrolling is janky or items flash. Root cause: missing `keyExtractor`, not providing `getItemLayout`, or re-rendering all items on every state change. Fix: add `keyExtractor`, memoize `renderItem` with `React.memo` or `useCallback`, supply `getItemLayout` for fixed-height rows.
- **Navigation state persistence** — stale route params after `navigation.goBack()`. Root cause: params are set on push and not updated when returning. Fix: use `navigation.setParams()`, shared state (context/store), or `useFocusEffect` to refresh data.
- **Animated value not resetting** — animation plays once then stops working. Root cause: `Animated.Value` retains its final value and is not reset before re-triggering. Fix: call `animatedValue.setValue(0)` before starting the animation again.

## Verification Commands

```bash
npx tsc --noEmit              # type-check without emitting
npx eslint .                  # lint the entire project
npx jest                      # run the full test suite
npx expo build                # validate Expo build (Expo projects)
eas build --local             # local EAS build for pre-flight check
```
