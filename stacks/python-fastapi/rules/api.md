---
description: API and router patterns for Python/FastAPI
alwaysApply: false
paths:
  - "app/routers/**"
  - "app/api/**"
---

# API Patterns

## Router Patterns

Keep route handlers thin — parse input, call a service, return a response. Business logic lives in services, not routers.

```python
# Good — thin handler, logic in service
@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    body: CreateUserRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    user = await user_service.create(db, body, created_by=current_user.id)
    return UserResponse.model_validate(user)
```

Use `Depends` for all injectable resources (database sessions, auth, config). Never instantiate services or open connections inside a handler.

## Input Validation

Every endpoint declares typed Pydantic models for request body, query parameters, and path parameters. No `dict`, no `Any`, no untyped `**kwargs`.

```python
class ListUsersParams(BaseModel):
    search: str | None = None
    is_active: bool = True
    limit: int = Field(default=20, ge=1, le=100)
    offset: int = Field(default=0, ge=0)
```

Use `Annotated` with `Query`, `Path`, `Body` for inline constraints when a full model is overkill.

## Response Formatting

Always set `response_model` on endpoints. Response models exclude internal fields — never return ORM objects directly.

```python
class UserResponse(BaseModel):
    id: int
    email: str
    name: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

Use `response_model_exclude_none=True` when optional fields should be omitted rather than sent as `null`.

## Error Responses

All errors return `{"detail": "human-readable message"}`. This shape is consistent across validation errors, auth errors, and domain errors. FastAPI's default `HTTPException` already uses this shape — match it in custom exception handlers.

Never return stack traces, SQL errors, or internal paths. In development, use middleware to add debug info to a separate `_debug` field if needed.

## Pagination

Use offset/limit for simple cases, cursor-based for large or real-time datasets.

```python
class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    limit: int
    offset: int
```

Always cap `limit` with a maximum (e.g., 100). Always return `total` count so clients can build pagination UI. For cursor pagination, return `next_cursor` and `has_more`.
