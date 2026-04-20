---
description: Error handling patterns for Python/FastAPI
alwaysApply: false
paths:
  - "app/**"
  - "src/**"
---

# Error Handling

## Error Classes

Define a base exception with `status_code` and `detail`. All domain errors inherit from it.

```python
class AppException(Exception):
    status_code: int = 500
    detail: str = "Internal server error"

    def __init__(self, detail: str | None = None, status_code: int | None = None):
        self.detail = detail or self.__class__.detail
        self.status_code = status_code or self.__class__.status_code

class NotFoundError(AppException):
    status_code = 404
    detail = "Resource not found"

class ConflictError(AppException):
    status_code = 409
    detail = "Resource already exists"
```

Never raise bare `Exception` or `ValueError` as a domain error. Never raise `HTTPException` inside services — services should not know about HTTP. Only routers and exception handlers translate domain errors to HTTP responses.

## Async Error Flow

Every `await` must be inside a `try/except` or propagate naturally to a caller that handles it. No fire-and-forget coroutines — if you spawn a background task, attach an error callback or log failures.

```python
# Good — error propagates to the router's exception handler
async def get_user(db: AsyncSession, user_id: int) -> User:
    user = await db.get(User, user_id)
    if user is None:
        raise NotFoundError(f"User {user_id} not found")
    return user

# Bad — swallowed silently
try:
    await send_notification(user)
except Exception:
    pass
```

Never use bare `except:` or `except Exception:` without logging. If you intentionally ignore an error, log it at `warning` level with context.

## HTTP Boundaries

Map domain exceptions to HTTP responses in one place using `@app.exception_handler`:

```python
@app.exception_handler(AppException)
async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
```

All error responses use the shape `{"detail": "human-readable message"}`. Do not leak stack traces, SQL fragments, or internal paths in production responses. Use a `ValidationError` handler to normalize Pydantic errors into the same shape.

## Logging

Use `structlog` or `loguru` for structured logging — never `print()`. Attach correlation IDs (from middleware) to every log entry so you can trace a request across service calls.

```python
logger = structlog.get_logger()

# Good — structured with context
logger.info("user_created", user_id=user.id, email=user.email)

# Bad — unstructured, unsearchable
print(f"Created user {user.id}")
```

Never log passwords, tokens, full request bodies, or PII. Use a redact list for sensitive fields. Log at the right level: `error` for unexpected failures, `warning` for recoverable issues, `info` for business events, `debug` for developer diagnostics.
