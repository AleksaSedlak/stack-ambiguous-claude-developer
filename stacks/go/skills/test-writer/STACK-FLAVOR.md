<!-- Stack flavor for test-writer — filled from research Pass 1 -->

## Framework Detection

Go uses the built-in `testing` package as its standard test framework. Detection signals:

- **File naming**: test files are named `*_test.go` and live alongside the source files in the same package
- **Import**: `import "testing"` in test files
- **Function signatures**: `func TestXxx(t *testing.T)` for tests, `func BenchmarkXxx(b *testing.B)` for benchmarks, `func FuzzXxx(f *testing.F)` for fuzz tests, `func ExampleXxx()` for testable examples
- **Subtests**: presence of `t.Run("name", func(t *testing.T) {...})` indicates subtest/table-driven patterns (Go 1.7+)
- **Concurrent test support**: `import "testing/synctest"` indicates use of the synctest package for testing concurrent code (Go 1.24+ experimental, Go 1.25 GA)
- **Benchmarks**: presence of `b.N` loop or `b.Loop()` (Go 1.24+) in `Benchmark` functions
- **Fuzz tests**: presence of `func FuzzXxx(f *testing.F)` with `f.Add(...)` seed corpus and `f.Fuzz(func(t *testing.T, ...) {...})` target

No external test framework configuration files are needed. The `go test` command discovers and runs all `*_test.go` files automatically.

<!-- Sources: synctest, testing-time, testing-b-loop, subtests, fuzz-beta -->

## Framework-Specific Test Patterns

### Table-driven tests (standard pattern)

```go
func TestTime(t *testing.T) {
    testCases := []struct {
        gmt  string
        loc  string
        want string
    }{
        {"12:31", "Europe/Zurich", "13:31"},
        {"12:31", "America/New_York", "7:31"},
        {"08:08", "Australia/Sydney", "18:08"},
    }
    for _, tc := range testCases {
        t.Run(tc.loc, func(t *testing.T) {
            // test logic using tc.gmt, tc.loc, tc.want
        })
    }
}
```

Use `t.Run` to create named subtests. This enables running individual cases with `go test -run TestTime/Europe`.

### Testable examples

```go
func ExampleReverse() {
    fmt.Println(reverse.String("hello"))
    // Output: olleh
}
```

Example functions reside in `_test.go` files, begin with `Example`, and use `// Output:` comments for verification. They appear in godoc and are executed as tests.

### Benchmarks (Go 1.24+ with `b.Loop`)

```go
func BenchmarkOperation(b *testing.B) {
    for b.Loop() {
        // code to measure
    }
}
```

`b.Loop()` prevents unwanted compiler optimizations, automatically excludes setup/cleanup from timing, and avoids accidental dependence on iteration count. Run with `go test -bench=BenchmarkOperation`.

### Fuzz tests

```go
func FuzzParseQuery(f *testing.F) {
    f.Add("key=value&foo=bar")
    f.Fuzz(func(t *testing.T, input string) {
        // function under test should not panic
        ParseQuery(input)
    })
}
```

Run with `go test -fuzz=FuzzParseQuery`. Fuzzing discovers panics and edge-case bugs through semi-random input mutation guided by code coverage.

### Concurrent code testing (testing/synctest)

```go
func TestConcurrentBehavior(t *testing.T) {
    synctest.Run(func() {
        ctx, cancel := context.WithCancel(context.Background())
        // set up concurrent code
        cancel()
        // synctest provides deterministic control over goroutines and fake time
    })
}
```

The `testing/synctest` package (Go 1.24+ experimental, Go 1.25 GA) provides deterministic testing of concurrent code without `time.Sleep` hacks.

### Integration test coverage (Go 1.20+)

Build coverage-instrumented binaries with `go build -cover`, run them with representative inputs, then merge coverage profiles using `go tool covdata`. This extends coverage analysis beyond unit tests.

<!-- Sources: subtests, synctest, testing-time, testing-b-loop, fuzz-beta, examples, integration-test-coverage -->

## Mocking Tools

### Interface-based mocking (idiomatic Go)

Go's implicit interface satisfaction makes mocking natural: define a small interface for the dependency, then swap in a mock implementation in tests. No framework is strictly required for simple cases.

### gomock (go.uber.org/mock)

The most widely used code-generation mocking framework. Originally Google's `golang/mock`, now maintained by Uber.

**Install:**

```bash
go install go.uber.org/mock/mockgen@latest
```

**When to use:** When you need strict expectation-based mocking — verifying call order, argument matching, and call counts on interface dependencies.

**How it works:** `mockgen` generates mock implementations from interfaces. You define expectations in the test, and the mock verifies them automatically.

```go
// Generate mocks for an interface
//go:generate mockgen -source=repo.go -destination=mock_repo.go -package=mypackage

func TestService(t *testing.T) {
    ctrl := gomock.NewController(t)
    mockRepo := NewMockRepository(ctrl)

    // Set expectations
    mockRepo.EXPECT().FindByID(gomock.Any(), "id-123").Return(&Entity{Name: "test"}, nil)

    svc := NewService(mockRepo)
    result, err := svc.Get(context.Background(), "id-123")
    // assertions...
}
```

### testify/mock (github.com/stretchr/testify)

Part of the testify suite, which also provides `assert` and `require` packages.

**When to use:** When you prefer hand-written mock structs with flexible assertion helpers, or when you already use testify for assertions. Good for simpler mocking needs without code generation.

**How it works:** You embed `mock.Mock` in a struct and implement the interface methods, delegating to `mock.Called()`. Expectations are set with `.On()` and verified with `.AssertExpectations()`.

```go
type MockRepository struct {
    mock.Mock
}

func (m *MockRepository) FindByID(ctx context.Context, id string) (*Entity, error) {
    args := m.Called(ctx, id)
    return args.Get(0).(*Entity), args.Error(1)
}

func TestService(t *testing.T) {
    mockRepo := new(MockRepository)
    mockRepo.On("FindByID", mock.Anything, "id-123").Return(&Entity{Name: "test"}, nil)

    svc := NewService(mockRepo)
    result, err := svc.Get(context.Background(), "id-123")
    // assertions...
    mockRepo.AssertExpectations(t)
}
```

### Choosing between gomock and testify/mock

| Criteria | gomock | testify/mock |
|---|---|---|
| Mock creation | Code-generated from interfaces | Hand-written structs |
| Expectation style | `EXPECT().Method().Return()` | `.On("Method").Return()` |
| Call ordering | Built-in `InOrder`, `After` | Manual |
| Best for | Large interfaces, strict contracts | Small interfaces, quick setup |

### Boundary mocking patterns

- **HTTP**: Use the standard library `net/http/httptest` package. `httptest.NewServer` creates a local test server; `httptest.NewRecorder` captures handler responses without network I/O.
- **Time**: The `testing/synctest` package (Go 1.24+) provides a fake clock for testing time-dependent code. Instead of `time.Sleep` in tests, `synctest.Run` controls time advancement deterministically, eliminating flaky time-based tests.
- **DB**: Define a repository interface and mock it with gomock or testify/mock. For integration tests, use test containers or an in-memory database.
- **Filesystem**: Accept `io.Reader`/`io.Writer` or `fs.FS` interfaces instead of concrete file paths, then pass in-memory implementations (e.g., `fstest.MapFS`) in tests.

<!-- Sources: gomock (uber-go/mock README), testify (stretchr/testify README), httptest (net/http/httptest package), synctest, testing-time -->
