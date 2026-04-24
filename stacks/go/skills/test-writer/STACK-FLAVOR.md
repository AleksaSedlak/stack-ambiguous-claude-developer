## Framework Detection

| Signal | Test framework |
|--------|---------------|
| `*_test.go` files in source directories | Built-in `testing` package (always present) |
| `testify` in go.mod | `stretchr/testify` for assertions (`assert`, `require`) and mocking (`mock`) |
| `gomock` or `mockgen` in go.mod | `uber-go/mock` or `golang/mock` for interface mocking with code generation |
| `httptest` imports in test files | Standard library HTTP testing utilities |
| `testcontainers-go` in go.mod | Docker-based integration test containers |
| `go-sqlmock` in go.mod | SQL driver mocking for database tests |

## Framework-Specific Test Patterns

**Table-driven tests (idiomatic Go):**
```go
func TestParseAmount(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int64
		err   bool
	}{
		{"valid cents", "12.34", 1234, false},
		{"no decimals", "100", 10000, false},
		{"empty string", "", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAmount(tt.input)
			if (err != nil) != tt.err {
				t.Fatalf("ParseAmount(%q) error = %v, want err %v", tt.input, err, tt.err)
			}
			if got != tt.want {
				t.Errorf("ParseAmount(%q) = %d, want %d", tt.input, got, tt.want)
			}
		})
	}
}
```

**HTTP handler tests:**
```go
func TestGetUser(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/users/123", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", w.Code, http.StatusOK)
	}
}
```

**Database tests:**
- Use test containers (`testcontainers-go`) for real database integration tests
- Use an in-memory SQLite with build tags (`//go:build integration`) for lighter tests
- Use `go-sqlmock` to mock the `database/sql` driver for unit tests
- Use `t.Cleanup()` for teardown instead of manual defer

**Benchmark tests:**
```go
func BenchmarkHash(b *testing.B) {
	for i := 0; i < b.N; i++ {
		Hash("test-input")
	}
}
```
Run with: `go test -bench=BenchmarkHash -benchmem ./...`

**Subtests for grouping:**
```go
func TestUserService(t *testing.T) {
	t.Run("Create", func(t *testing.T) { ... })
	t.Run("Update", func(t *testing.T) { ... })
	t.Run("Delete", func(t *testing.T) { ... })
}
```

**Test helpers:**
```go
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite3", ":memory:")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}
```

## Mocking Tools

- **Hand-written fakes** — the Go community prefers simple fake implementations of interfaces for testing. Define a struct that implements the interface with configurable return values
- **`gomock` + `mockgen`** — code-generated mocks for interfaces. Run `mockgen -source=repo.go -destination=mock_repo_test.go -package=service_test`. Use `ctrl := gomock.NewController(t)` in tests
- **`httptest`** — standard library for HTTP testing: `httptest.NewServer()` for a real test server, `httptest.NewRecorder()` for unit-testing handlers
- **`testify/mock`** — alternative mock framework from stretchr/testify. Define mock structs embedding `mock.Mock`, set expectations with `.On()` and `.Return()`
- **`go-sqlmock`** — mock the `database/sql` driver to test database interactions without a real database
- **Reset state**: use `t.Cleanup()` for per-test teardown, avoid package-level `TestMain` unless truly shared setup is needed
