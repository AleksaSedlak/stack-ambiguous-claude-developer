<!-- Stack flavor for debug-fix — filled from research Pass 1 -->

## Reproduction Tools

- `go test ./...` — run all tests in the module
- `go test -run TestName ./pkg/...` — run a specific test by name
- `go test -run TestName/subtest_name` — run a specific subtest (subtests use `t.Run("name", func(t *testing.T) {...})`)
- `go test -v ./...` — verbose output showing each test name and result
- `go test -fuzz=FuzzName ./pkg/...` — run fuzz testing to discover edge-case panics and bugs
- `go test -count=1 ./...` — disable test caching for a fresh run
- `go test -race ./...` — run tests with the race detector enabled
- `go build -cover` — build a coverage-instrumented binary for integration testing (Go 1.20+)
- `GOEXPERIMENT=synctest go test ./...` — enable experimental `testing/synctest` for concurrent code testing (Go 1.24+)
- `dlv debug ./cmd/myapp` — start Delve debugger on a program
- `dlv test ./pkg/...` — start Delve debugger on tests

<!-- Sources: subtests, synctest, fuzz-beta, testing-time, integration-test-coverage, debug-opt -->

## Environment Checks

- `go version` — check installed Go runtime version
- `go env` — display all Go environment variables (GOPATH, GOROOT, GOPROXY, etc.)
- `go mod tidy` — sync go.mod/go.sum with actual imports; fixes missing or extraneous dependencies
- `go mod download` — download all dependencies to the module cache
- `go clean -cache` — clear the build cache
- `go clean -testcache` — clear only cached test results
- `go install example.com/cmd@latest` — install executables (replaces deprecated `go get` for installs since Go 1.17)
- Check `go.mod` for the `go` directive to confirm the minimum Go version the module targets
- Check `GOPROXY` setting if dependency downloads fail (default: `https://proxy.golang.org,direct`)

<!-- Sources: go-get-install-deprecation, version-numbers, major-version -->

## Common Bug Patterns

- **Unchecked error returns** — symptom: silent failures, nil pointer panics downstream. Root cause: ignoring the `error` return value from functions (e.g., `os.Open` returns `(file, err)` but `err` is discarded). Fix: always check `if err != nil` and handle or propagate the error. Use `errors.Is` and `errors.As` (Go 1.13+) to inspect wrapped errors rather than comparing strings.

- **Error wrapping without `%w`** — symptom: `errors.Is` and `errors.As` fail to match wrapped errors. Root cause: using `fmt.Errorf("context: %v", err)` instead of `fmt.Errorf("context: %w", err)`. Fix: use `%w` verb in `fmt.Errorf` to preserve the error chain so callers can unwrap with `errors.Is`/`errors.As`.

- **Repetitive error handling instead of error-as-value patterns** — symptom: verbose, cluttered code with `if err != nil { return err }` on every other line. Root cause: treating error handling mechanically. Fix: errors are values in Go; program them using patterns like `errWriter` that encapsulate error checking (e.g., a writer wrapper that records the first error and skips subsequent writes).

- **Debugging optimized binaries** — symptom: variable values appear as `<optimized out>` in debugger, breakpoints land on unexpected lines. Root cause: Go compiler optimizations (inlining, register allocation) obscure debug info. Fix: Go 1.12+ significantly improved debugging of optimized binaries with Delve; use `dlv` rather than GDB. For older Go, build with `go build -gcflags="-N -l"` to disable optimizations.

- **Flaky concurrent tests** — symptom: tests pass most of the time but intermittently fail or hang. Root cause: race conditions in test assertions on goroutine results, or time-dependent tests using `time.Sleep`. Fix: use `testing/synctest` (Go 1.24+ experimental, GA in Go 1.25) to deterministically test concurrent code, or use channels/`sync.WaitGroup` for synchronization instead of sleeps.

<!-- Sources: error-handling-and-go, go1.13-errors, errors-are-values, debug-opt, debug-gdb, synctest, testing-time -->

## Verification Commands

- `go build ./...` — compile all packages (type-check without producing a binary)
- `go vet ./...` — run the built-in static analyzer for common mistakes
- `go test ./...` — run all tests
- `go test -race ./...` — run tests with the race detector
- `go test -cover ./...` — run tests with coverage summary
- `go test -coverprofile=coverage.out ./... && go tool cover -html=coverage.out` — generate and view HTML coverage report
- `gofmt -l .` — list files not matching canonical formatting (exit 0 = all formatted)
- `govulncheck ./...` — scan for known vulnerabilities in dependencies (install: `go install golang.org/x/vuln/cmd/govulncheck@latest`)

<!-- Sources: synctest, govulncheck, integration-test-coverage, subtests, testing-time -->
