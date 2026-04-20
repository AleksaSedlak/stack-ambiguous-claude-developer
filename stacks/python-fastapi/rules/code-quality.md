---
description: Code quality patterns for Python/FastAPI
alwaysApply: true
---

# Code Quality

## Principles

- Functions do one thing. If you can't name it without "and", split it.
- No magic values — extract to named constants or module-level `UPPER_SNAKE` variables.
- Handle errors at the boundary. Don't catch and re-raise without adding context.
- No premature abstractions. Three similar lines > an ABC used once.
- Don't add features or "improve" things beyond what was asked.
- No dead code or commented-out blocks. Git has history.
- Type hints on every function signature. `Any` requires an inline comment justifying it.

## Naming

- **Files/modules**: `snake_case.py` — `user_service.py`, `test_users.py`.
- **Classes**: `PascalCase` — `UserService`, `OrderRepository`.
- **Functions/variables**: `snake_case` — `get_user`, `is_valid`.
- **Constants**: `UPPER_SNAKE_CASE` — `MAX_RETRIES`, `DEFAULT_TIMEOUT`.
- **Private**: leading `_` — `_validate_token`. Double underscore only for name mangling (rare).
- **Booleans**: `is_`/`has_`/`can_`/`should_` prefix.

## Python Specifics

- Use `from __future__ import annotations` for postponed evaluation (PEP 604 unions everywhere).
- Prefer `pathlib.Path` over `os.path` for filesystem operations.
- Use `dataclasses` or Pydantic `BaseModel` for data containers — no raw dicts as domain objects.
- Prefer `Enum` over string literals for fixed sets of values.
- Use `contextlib.asynccontextmanager` for resource lifecycle (DB sessions, HTTP clients).
- No mutable default arguments (`def f(items=[])`). Use `None` + assignment inside.

## Patterns

**Use type narrowing, not isinstance + cast:**
```python
# good
match result:
    case Ok(value):
        return value
    case Err(error):
        raise error

# avoid
if isinstance(result, Ok):
    return cast(Ok, result).value
```

**Async by default for I/O:**
```python
# good — non-blocking
async def get_user(user_id: int) -> User:
    return await db.execute(select(User).where(User.id == user_id))

# avoid — blocks the event loop
def get_user(user_id: int) -> User:
    return db.execute(select(User).where(User.id == user_id))
```
