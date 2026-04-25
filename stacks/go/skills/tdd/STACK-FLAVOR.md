<!-- Stack flavor for tdd — filled from research Pass 1 -->

## Signature Examples

Go function signatures include explicit parameter types, return types, and commonly return `(result, error)` tuples.

### Basic function signature

```go
func ProcessOrder(ctx context.Context, orderID string) (*Order, error) {
    // implementation
}
```

### Generic function signature (Go 1.18+)

```go
func Clone[S ~[]E, E any](s S) S {
    return append(s[:0:0], s...)
}
```

Type parameters use square brackets. Constraints like `~[]E` (underlying type is slice of E) and `any` define what types are accepted.

### Method signature

```go
func (t *Tree[E]) Insert(element E) {
    t.root = t.root.insert(element)
}
```

### Interface definition (the "signature" for behavior contracts)

```go
type Comparer[E any] interface {
    Compare(a, b E) int
}
```

Generic interfaces (Go 1.18+) can parameterize the contract itself.

### Error interface

```go
type error interface {
    Error() string
}
```

Custom error types implement this interface and can support wrapping via an `Unwrap() error` method (Go 1.13+).

In TDD, write the function/method signature and return type first, then write the test calling it, then implement the body.

<!-- Sources: deconstructing-type-parameters, generic-interfaces, intro-generics, coretypes, error-handling-and-go -->

## Validation Libraries

### go-playground/validator

The most widely used struct validation library in Go. It is the default validator for the [gin](https://github.com/gin-gonic/gin) web framework.

**Install:**

```bash
go get github.com/go-playground/validator/v10
```

**Struct tag-based validation:**

```go
type CreateOrderRequest struct {
    CustomerID string  `json:"customer_id" validate:"required,uuid"`
    Amount     float64 `json:"amount"      validate:"required,gt=0"`
    Currency   string  `json:"currency"    validate:"required,len=3"`
    Email      string  `json:"email"       validate:"required,email"`
}

func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
    var req CreateOrderRequest
    // decode request body...

    validate := validator.New()
    if err := validate.Struct(req); err != nil {
        // handle validation errors
        return
    }
    // proceed with validated data
}
```

**Key features (from the research):**

- Cross-field and cross-struct validations via tags or custom validators
- Slice, array, and map diving — validate any level of a multidimensional field
- Dive into both map keys and values
- Handles type interfaces by determining underlying type before validation
- Alias validation tags — map multiple validations to a single tag
- Custom field name extraction (e.g., use JSON field names in error messages)
- Customizable i18n-aware error messages
- Handles custom field types such as sql driver `Valuer`

**When to validate:**

Validate at **boundaries** — HTTP handlers, gRPC service methods, CLI argument parsing, message queue consumers. Do not scatter validation throughout business logic. The handler decodes and validates; the service layer receives already-validated data.

<!-- GAP: The research excerpts did not cover code-based (non-tag) validation libraries such as ozzo-validation. Only go-playground/validator was covered. -->

<!-- Sources: go-playground/validator README -->
