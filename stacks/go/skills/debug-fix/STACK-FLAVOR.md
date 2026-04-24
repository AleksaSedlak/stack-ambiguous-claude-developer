## Reproduction Tools

- Failing test: `go test ./... -run TestName` (regex match on test name)
- Run the program: `go run .` or `go run ./cmd/server`
- Delve debugger: `dlv debug ./cmd/server` then `break main.main`, `continue`, `next`, `print var`
- Curl against running server: `curl -X POST http://localhost:8080/api/...`
- Minimal reproduction: write a `main_test.go` with a focused `TestRepro` function

## Environment Checks

- Go version: `go version` — check against `go` directive in `go.mod`
- Environment: `go env GOPATH GOROOT GOPROXY GOFLAGS`
- Module state: `go mod tidy` then `git diff go.mod go.sum` — if they changed, deps were stale
- Build cache: `go clean -cache` to clear, `go clean -testcache` to clear test results only
- Vendor dir: if using `vendor/`, run `go mod vendor` and check for changes
- CGO: `go env CGO_ENABLED` — some packages (SQLite, etc.) require CGO=1

## Common Bug Patterns

- **Goroutine leak** — goroutine started but never returns (blocked channel, missing context cancellation). Symptom: memory grows over time, `runtime.NumGoroutine()` keeps climbing. Fix: always pass `context.Context`, use `errgroup` for managed goroutine lifecycles, ensure channels have consumers or use buffered channels
- **Nil pointer dereference** — calling a method on a nil interface or pointer. Symptom: `runtime error: invalid memory address or nil pointer dereference`. Fix: check before use, return concrete types not interfaces where possible, use the comma-ok idiom for type assertions
- **Data race** — concurrent map access or shared variable without mutex. Symptom: intermittent wrong results, crash with `fatal error: concurrent map writes`. Fix: run `go test -race`, use `sync.Mutex`, `sync.RWMutex`, or channels for synchronization
- **Deferred function in loop** — `defer` runs at function end, not loop iteration end. Symptom: resource exhaustion (too many open files, connections). Fix: wrap the loop body in an anonymous function `func() { f := open(); defer f.Close(); ... }()` or manage lifecycle explicitly
- **Interface satisfaction at runtime** — type doesn't implement interface, discovered only when used. Symptom: compile error at the usage site, not the definition. Fix: add compile-time check `var _ Interface = (*Type)(nil)` near the type definition
- **Error swallowing** — `result, _ := someFunc()` discards the error. Symptom: silent failures, nil results used downstream causing panics. Fix: always handle errors explicitly, never use `_` for error returns
- **Slice append gotcha** — `append` may or may not modify the underlying array depending on capacity. Symptom: two slices sharing backing storage unexpectedly overwrite each other. Fix: always use `s = append(s, item)`, never rely on aliased slices, use `slices.Clone()` when sharing
- **Context cancellation not propagated** — using `context.Background()` instead of the request context. Symptom: operations continue after client disconnects, wasting resources. Fix: thread `ctx` through all layers, use `context.WithTimeout` for deadlines

## Verification Commands

- Vet: `go vet ./...`
- Lint: `golangci-lint run` (if installed)
- Format check: `gofmt -l .` (lists unformatted files)
- Tests: `go test ./...`
- Race detector: `go test -race ./...`
- Build: `go build ./...`
