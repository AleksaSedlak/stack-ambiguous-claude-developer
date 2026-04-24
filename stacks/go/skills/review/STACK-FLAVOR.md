## Verification Commands

- Vet: `go vet ./...`
- Lint: `golangci-lint run` (if installed)
- Format check: `gofmt -l .` (lists unformatted files)
- Unit tests: `go test ./...`
- Race detector: `go test -race ./...`
- Build: `go build ./...`

## Stack-Specific Review Patterns

- **Every error must be handled** — no `_` for error returns. Every `result, err := someFunc()` must check `err`. The only exception is when the function signature guarantees no error (and even then, prefer handling it)
- **`context.Context` as first parameter** — functions that do I/O, database calls, or HTTP requests must accept `context.Context` as their first parameter. Name it `ctx`
- **No `init()` functions unless absolutely necessary** — `init()` is hard to test, creates hidden side effects, and makes dependency graphs opaque. Prefer explicit initialization in `main()` or constructor functions
- **Exported functions need doc comments** — every exported function, type, and constant must have a doc comment starting with the name: `// DeactivateUser marks a user as inactive...`
- **No `panic` in library code** — library packages must return errors, never panic. Only `main` or top-level server bootstrap may call `log.Fatal` / `panic` as a last resort
- **Use `errors.Is`/`errors.As` not `==` for error comparison** — wrapped errors (via `fmt.Errorf("...: %w", err)`) won't match with `==`. Always use `errors.Is(err, ErrNotFound)` or `errors.As(err, &target)`
- **Goroutines must have cleanup** — every `go func()` must have a way to stop: context cancellation, `sync.WaitGroup`, or `errgroup.Group`. Orphaned goroutines are leaks
- **No global mutable state** — pass dependencies explicitly via constructor injection. Global vars make testing hard and create hidden coupling. Constants and read-only config are acceptable
- **Check `go vet` and `-race` flag results** — `go vet ./...` catches common mistakes (printf format mismatches, unreachable code). `go test -race ./...` detects data races. Both must pass clean
