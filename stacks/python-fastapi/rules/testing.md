---
description: Testing patterns for Python/FastAPI
alwaysApply: false
paths:
  - "tests/**"
  - "**/*test*.py"
---

# Testing

## Principles

- Write tests that verify behavior, not implementation details.
- Prefer real implementations over mocks. Only mock at system boundaries (HTTP clients, databases, external APIs).
- If a test is flaky, fix or delete it. Never retry to make it pass.
- No logic (if/loops) in tests — if you need branching, write two tests.
- Run the specific test file after changes: `pytest tests/path/to/test_file.py -x`.

## Naming & Structure

`test_<thing>_<condition>_<expected>` — descriptive and grep-friendly:

```python
def test_create_user_with_duplicate_email_returns_409(): ...
def test_get_order_without_auth_returns_401(): ...
```

Arrange-Act-Assert in every test. No exceptions. Blank lines separate the three sections.

```python
async def test_create_user_returns_created():
    # Arrange
    payload = {"email": "new@example.com", "password": "strongpass123"}

    # Act
    response = await client.post("/users", json=payload)

    # Assert
    assert response.status_code == 201
    assert response.json()["email"] == "new@example.com"
```

## Fixtures & Conftest

Shared fixtures live in `conftest.py` at the appropriate directory level. Prefer factory functions over raw fixture data.

```python
@pytest.fixture
async def db_session(engine):
    async with AsyncSession(engine) as session:
        async with session.begin():
            yield session
        await session.rollback()

@pytest.fixture
async def client(app):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
```

Use `pytest.mark.asyncio` (or `asyncio_mode = "auto"` in `pyproject.toml`) for async tests. Never mix sync and async test runners.

## Mocking

Mock at boundaries only — HTTP calls, database sessions, external services:

```python
# Good — override the FastAPI dependency
app.dependency_overrides[get_db] = lambda: mock_session
app.dependency_overrides[get_current_user] = lambda: fake_user

# Bad — patching internal service methods defeats the test
with patch.object(UserService, "_hash_password"): ...
```

Use `httpx.MockTransport` or `respx` for HTTP mocking. Use `dependency_overrides` for FastAPI dependencies — it's cleaner than `unittest.mock.patch` and respects the DI graph.

## Coverage

Cover happy path, error paths, and edge cases for each public endpoint and service method. Coverage is a symptom of good tests, not a goal. A test that hits a line without asserting its behavior is a false signal.

Run coverage with `pytest --cov=app --cov-report=term-missing` to see uncovered lines.
