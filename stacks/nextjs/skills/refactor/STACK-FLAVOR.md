## Verification Commands

Run after each refactoring step to confirm nothing broke. Run them in this order — type errors are cheapest to catch first.

```bash
# 1. Type-check — catches renamed props, missing imports, broken interfaces
npx tsc --noEmit

# 2. Lint — catches unused variables, import order issues, React-specific problems
npx next lint                   # Next.js-aware ESLint (includes react, react-hooks, next plugins)
# or: npx eslint . --ext .ts,.tsx

# 3. Format — ensure consistent style after moving code around
npx prettier --check .          # check only (non-destructive)
npx prettier --write .          # auto-fix formatting

# 4. Tests — confirm behavior is preserved
npx vitest run                  # or: npx jest --passWithNoTests
npx vitest run --changed        # run only tests affected by changed files (faster feedback)

# 5. Build — the final gate; catches SSR-specific issues, missing 'use client',
#    bad dynamic imports, broken static generation
npm run build
```
