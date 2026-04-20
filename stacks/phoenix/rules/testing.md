---
alwaysApply: true
---

# Testing

## Principles

- Write tests that verify behavior, not implementation details.
- Prefer real implementations over mocks. Only mock at system boundaries (HTTP clients, external APIs, queues).
- If a test is flaky, fix or delete it. Never retry to make it pass.
- No logic (if/loops) in tests — if you need branching, write two tests.
- Run the specific test file after changes: `mix test test/path/to/file_test.exs`.

## Naming & Structure

`test "does thing when condition"` — no `should`. Group with `describe "function_name/arity"`.

Arrange-Act-Assert in every test. No exceptions.

## Test Cases

| Module | When to use |
|---|---|
| `DataCase` | Tests that touch the database |
| `ConnCase` | Controller and LiveView integration tests |
| `ExUnit.Case` | Pure unit tests, no DB or HTTP |

Use `async: true` whenever safe. Do not use `async: true` with the `Mock` library — it patches globally and causes race conditions. `Mox` is process-local and safe with `async: true`.

## Database Isolation

`Ecto.Adapters.SQL.Sandbox` handles isolation — every test rolls back automatically. Never truncate or delete in test setup.

## Factories

Plain functions in `test/support/factory.ex` — no factory library needed:

```elixir
def build(:user, attrs \\ []) do
  %User{email: "user#{System.unique_integer()}@example.com"}
  |> struct!(Map.new(attrs))
end

def insert(factory, attrs \\ []), do: factory |> build(attrs) |> Repo.insert!()
```

## Mocking with Mox

Define a `@behaviour`, inject the mock through `config/test.exs`, declare with `Mox.defmock/2` in `test_helper.exs`. Always use `setup :verify_on_exit!` — without it, unused `expect` calls pass silently.

## Assertions

- Pattern match result tuples: `assert {:ok, user} = Accounts.create_user(params)`
- String/regex contains: `assert html =~ "Welcome"`, `refute html =~ "error"`
- Changeset errors via `errors_on/1` from DataCase
- Async messages: `assert_received {:event, :triggered}`, `refute_received`
- Log output: `capture_log(fn -> ... end)` from `ExUnit.CaptureLog`
