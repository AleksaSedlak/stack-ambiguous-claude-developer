<!-- Stack flavor for review — filled from research Pass 1 -->

## Verification Commands

Run these during self-review to validate correctness:

- `go build ./...` — compile all packages (type-check)
- `go vet ./...` — static analysis for common mistakes
- `gofmt -l .` — check formatting compliance
- `go test ./...` — run all tests
- `go test -race ./...` — detect data races
- `go test -cover ./...` — check test coverage
- `govulncheck ./...` — scan for known vulnerabilities in dependencies (install: `go install golang.org/x/vuln/cmd/govulncheck@latest`)
- `go mod tidy && git diff go.mod go.sum` — verify dependency declarations are clean

<!-- Sources: synctest, govulncheck, integration-test-coverage, subtests, testing-time -->

## Stack-Specific Review Patterns

### Error handling

- **Check all error returns** — every function returning `error` must have its error checked. Unchecked errors are a top source of Go bugs. Look for patterns like `f, _ := os.Open(...)` where the error is silently discarded.
- **Use `%w` for error wrapping** — when adding context with `fmt.Errorf`, use `%w` (not `%v`) to preserve the error chain. This allows callers to use `errors.Is` and `errors.As` for inspection. Review that error wrapping forms a meaningful chain.
- **Prefer `errors.Is`/`errors.As` over type assertions** — since Go 1.13, use `errors.Is(err, target)` instead of `err == target` and `errors.As(err, &target)` instead of direct type assertions. These traverse the full error chain.

### Concurrency safety

- **Race conditions** — review goroutine access to shared state. Ensure proper synchronization via channels, `sync.Mutex`, or `sync.RWMutex`. The `-race` flag should be part of CI.
- **Goroutine leaks** — review that every launched goroutine has a clear termination path (via context cancellation, channel close, or `sync.WaitGroup`). Leaked goroutines consume memory indefinitely.
- **Context propagation** — verify that `context.Context` is threaded through request-scoped call chains and that cancellation is respected.

### Security

- **Vulnerability scanning** — `govulncheck ./...` analyzes which vulnerable functions your code actually calls, reducing noise compared to generic CVE scanners. It should be run in CI.
- **Security best practices** — keep Go version and dependencies up to date. Scan code for vulnerabilities regularly. Use fuzzing (`go test -fuzz`) to discover edge-case inputs that cause panics.
- **Report format** — security bugs in Go itself go to `security@golang.org`; public vulnerabilities in Go modules can be reported to the Go vulnerability database.

### Module hygiene

- **Major version bumps** — a new major version (v2+) requires a `/v2` suffix in the module path. Review that import paths match the major version.
- **`go install` vs `go get`** — since Go 1.17, `go get` is deprecated for installing executables; use `go install example.com/cmd@latest` instead. `go get` should only be used to manage go.mod dependencies.

<!-- Sources: error-handling-and-go, go1.13-errors, errors-are-values, security-policy, vuln-index, vuln-database, security-best-practices, govulncheck, go-get-install-deprecation, major-version -->
