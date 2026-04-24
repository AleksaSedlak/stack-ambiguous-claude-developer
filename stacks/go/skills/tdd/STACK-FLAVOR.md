## Signature Examples

```go
// Service method with context and error return
func DeactivateUser(ctx context.Context, id string) (*User, error) { ... }

// Repository interface method
type UserRepository interface {
	FindByID(ctx context.Context, id string) (*User, error)
	Save(ctx context.Context, user *User) error
}

// HTTP handler (standard library)
func (h *UserHandler) HandleGetUser(w http.ResponseWriter, r *http.Request) { ... }

// Gin/Fiber-style handler
func (h *UserHandler) GetUser(c *gin.Context) { ... }
```

## Validation Libraries

- **`go-playground/validator`** — struct tag-based validation. Decorate fields with `validate:"required,email"`, call `validator.New().Struct(input)`. Most popular in Gin ecosystem.
- **`ozzo-validation`** — code-based validation rules. Define validation in methods: `return validation.ValidateStruct(u, validation.Field(&u.Email, validation.Required, is.EmailFormat))`. More flexible than tags.
- **Custom validation functions** — for domain-specific rules, write functions returning `error`: `func validateAge(age int) error { if age < 0 { return errors.New("age must be non-negative") }; return nil }`. Compose with `errors.Join` for multiple checks.
- Always validate at the handler/transport boundary. Services trust their inputs — validation errors should never originate from deep inside business logic.
