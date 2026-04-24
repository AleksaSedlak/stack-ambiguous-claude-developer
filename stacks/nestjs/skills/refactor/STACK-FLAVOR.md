## Verification Commands

Run after each refactoring step to confirm nothing broke:

```bash
# Type-check without emitting
npx tsc --noEmit

# Lint
npx eslint 'src/**/*.ts' --max-warnings=0

# Format check
npx prettier --check 'src/**/*.ts'

# Unit tests
npx jest

# E2E tests
npx jest --config ./test/jest-e2e.json

# Full build (catches decorator metadata issues tsc --noEmit may miss)
npm run build
```
