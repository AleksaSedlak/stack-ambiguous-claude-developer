<!-- Stack flavor for refactor — filled from research Pass 1 -->

## Verification Commands

Run these after each refactoring step to confirm nothing broke:

- `go build ./...` — compile all packages; catches type errors, missing imports, unused variables
- `go vet ./...` — static analysis for common mistakes (printf format mismatches, unreachable code, suspicious constructs)
- `gofmt -l .` — list files with non-canonical formatting; run `gofmt -w .` to auto-fix
- `go test ./...` — run the full test suite
- `go test -race ./...` — run tests with the race detector to catch data races introduced by refactoring
- `go test -count=1 ./...` — bypass cached test results for a guaranteed fresh run
- `go test -cover ./...` — verify coverage has not regressed after refactoring
- `govulncheck ./...` — check that refactored dependency usage hasn't introduced known vulnerabilities (install: `go install golang.org/x/vuln/cmd/govulncheck@latest`)
- `go mod tidy` — clean up go.mod/go.sum after adding or removing imports

<!-- Sources: synctest, govulncheck, integration-test-coverage, subtests, testing-time -->
