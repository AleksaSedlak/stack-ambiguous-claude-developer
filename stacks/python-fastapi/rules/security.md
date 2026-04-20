---
description: Security patterns for Python/FastAPI
alwaysApply: false
paths:
  - "app/**"
  - "src/**"
---

# Security

## Input Validation

Every endpoint must declare a Pydantic model for its request body. No raw `dict` or `Any` parameters on public routes.

```python
# Good — validated at the boundary
class CreateUser(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(max_length=255)

@router.post("/users")
async def create_user(body: CreateUser): ...

# Bad — unvalidated dict
@router.post("/users")
async def create_user(body: dict): ...
```

Use `Field` validators for constraints (min/max length, regex patterns, gt/lt for numbers). Use `model_config = ConfigDict(extra="forbid")` on models that should reject unknown fields. Use `Annotated[str, Field(...)]` for path/query parameters that need validation.

## Injection Prevention

**SQL** — use SQLAlchemy parameterized queries exclusively:

```python
# Good — parameterized
stmt = select(User).where(User.email == email)
await session.execute(stmt)

# Dangerous — f-string SQL
await session.execute(text(f"SELECT * FROM users WHERE email = '{email}'"))
```

Never use `text()` with f-strings or string concatenation. If you need raw SQL, use `text()` with bound parameters: `text("SELECT * FROM users WHERE email = :email").bindparams(email=email)`.

**Code execution** — never call `eval()`, `exec()`, or `compile()` on user-supplied input. Never use `subprocess.run(..., shell=True)` with user input. Pass arguments as a list: `subprocess.run(["ping", "-c", "1", host])`.

**Deserialization** — never use `pickle.loads()` or `yaml.load()` (use `yaml.safe_load()`) on untrusted data.

## Authentication

Use `OAuth2PasswordBearer` for token-based auth. JWT tokens via `python-jose` (or `PyJWT`). Password hashing via `passlib` with argon2 or bcrypt — never MD5 or SHA for passwords.

```python
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/token")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.jwt_algorithm])
        user_id: int = payload["sub"]
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

Always set token expiration (`exp` claim). Use constant-time comparison (`secrets.compare_digest`) for any token or secret comparison outside of JWT library internals.

## Authorization

Use `Depends` for auth injection — never read tokens manually from headers in route handlers.

```python
# Good — scoped to current user
@router.get("/orders/{order_id}")
async def get_order(
    order_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    order = await db.get(Order, order_id)
    if order is None or order.user_id != current_user.id:
        raise HTTPException(status_code=404)
    return order

# Bad — no ownership check (IDOR)
@router.get("/orders/{order_id}")
async def get_order(order_id: int, db: AsyncSession = Depends(get_db)):
    return await db.get(Order, order_id)
```

For role-based access, create reusable dependencies: `require_admin = Depends(get_admin_user)`.

## Secrets

Load all configuration through `pydantic-settings` (`BaseSettings`). Never read `os.environ` directly in application code.

```python
class Settings(BaseSettings):
    secret_key: str
    database_url: str
    redis_url: str = "redis://localhost:6379"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

settings = Settings()
```

Never commit `.env` files. Maintain `.env.example` with all required keys and dummy values. Fail fast at startup if required settings are missing — `pydantic-settings` does this automatically for fields without defaults.

## Dependencies

Run `pip audit` (or `safety check`) in CI on every PR. Pin security-critical packages. Review new dependencies before adding — check maintenance status, download counts, and known CVEs. Prefer well-maintained packages from known authors over obscure alternatives.
