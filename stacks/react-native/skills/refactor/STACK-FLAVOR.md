## Verification Commands

Run after each refactoring step to confirm nothing broke:

```bash
npx tsc --noEmit              # type-check — catches renamed props, removed exports, changed signatures
npx eslint .                  # lint — catches unused imports, rule violations from restructuring
npx jest                      # test suite — confirms behavior is preserved after refactoring
npx react-native run-ios      # build iOS — verifies native module links are intact
npx react-native run-android  # build Android — verifies Gradle/native integration
```

For Expo projects, replace the native build commands with:

```bash
npx expo build                # validate Expo build pipeline
eas build --local             # local EAS build for faster feedback
```
