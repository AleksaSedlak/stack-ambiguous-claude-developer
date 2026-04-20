---
paths:
  - "lib/**_web/controllers/**"
  - "lib/**_web/live/**"
  - "lib/**_web/plugs/**"
  - "lib/**_web/router.ex"
  - "lib/**/*.ex"
---

# Error Handling

## Return Values

Every public function that can fail must return a result tuple. Never use `nil` as a signal for failure.

```elixir
# good
{:ok, user}
{:error, :not_found}
{:error, :unauthorized}
{:error, {:validation_failed, changeset}}

# add context with nested tuples when the caller needs to know the source
{:error, {:redis_error, reason}}
{:error, {:http_error, status_code}}

# bad
nil              # caller cannot distinguish "not found" from "not loaded"
false            # no context about what failed
raise "not found"  # forces caller to use try/rescue
```

## Error Pipelines

Use `with` for sequential operations that can fail. Never nest `case` blocks.

```elixir
# good
with {:ok, user} <- Accounts.fetch_user(user_id),
     {:ok, account} <- Billing.fetch_account(user.account_id),
     {:ok, _} <- Billing.charge(account, amount) do
  {:ok, :charged}
else
  {:error, :not_found} -> {:error, :user_not_found}
  {:error, reason} -> {:error, reason}
end

# bad — nested case is hard to read and extend
case Accounts.fetch_user(user_id) do
  {:ok, user} ->
    case Billing.fetch_account(user.account_id) do
      {:ok, account} -> ...
    end
end
```

## try/rescue

Use `try/rescue` only when calling external libraries that may raise exceptions. Its purpose is to convert exceptions into result tuples — not to control your own flow.

```elixir
# good — wrapping an external HTTP call that may raise
def fetch_page(url) do
  try do
    case http_client.get(url) do
      {:ok, %{status: 200, body: body}} -> {:ok, body}
      {:ok, %{status: _}} -> {:error, :request_failed}
      {:error, _} -> {:error, :request_failed}
    end
  rescue
    _e -> {:error, :request_failed}
  end
end

# bad — using try/rescue for your own logic
def get_user(id) do
  try do
    user = Repo.get!(User, id)
    {:ok, user}
  rescue
    Ecto.NoResultsError -> {:error, :not_found}
  end
end

# good — use Repo.get/2 instead, it returns nil without raising
def get_user(id) do
  case Repo.get(User, id) do
    nil -> {:error, :not_found}
    user -> {:ok, user}
  end
end
```

## Let It Crash

Do not rescue unexpected errors. If something truly unexpected happens, let the process crash — the Supervisor will restart it cleanly. A crash with a clear stack trace is better than a silent wrong state.

Only handle errors you explicitly expect and know how to recover from.

## Ecto Changesets

Changeset errors are `{:error, %Ecto.Changeset{}}`. Never transform this tuple before returning it to the caller — the controller or LiveView is responsible for rendering it.

```elixir
# good — context returns the changeset as-is
def create_user(attrs) do
  %User{}
  |> User.changeset(attrs)
  |> Repo.insert()
end

# bad — transforming the changeset hides information
def create_user(attrs) do
  case Repo.insert(User.changeset(%User{}, attrs)) do
    {:ok, user} -> {:ok, user}
    {:error, _changeset} -> {:error, :invalid_params}  # loses all field errors
  end
end
```

## Controllers — action_fallback

Use `action_fallback` to translate `{:error, reason}` tuples into HTTP responses in one place. Controllers should never contain `try/rescue` or manual error rendering.

```elixir
# router or controller
defmodule MyAppWeb.UserController do
  use MyAppWeb, :controller
  action_fallback MyAppWeb.FallbackController

  def show(conn, %{"id" => id}) do
    with {:ok, user} <- Accounts.fetch_user(id) do
      render(conn, :show, user: user)
    end
    # on {:error, reason}, Phoenix calls FallbackController.call(conn, {:error, reason})
  end
end

# lib/my_app_web/controllers/fallback_controller.ex
defmodule MyAppWeb.FallbackController do
  use MyAppWeb, :controller

  def call(conn, {:error, :not_found}) do
    conn |> put_status(:not_found) |> render(:error, message: "Not found")
  end

  def call(conn, {:error, :unauthorized}) do
    conn |> put_status(:unauthorized) |> render(:error, message: "Unauthorized")
  end

  def call(conn, {:error, %Ecto.Changeset{} = changeset}) do
    conn |> put_status(:unprocessable_entity) |> render(:error, changeset: changeset)
  end
end
```

## Logging

Log at the boundary (controller, plug, message handler) — not deep inside contexts. Contexts return errors, callers decide whether to log.

Use named uppercase event strings with structured metadata:

```elixir
# good
Logger.error("USER_FETCH_FAILED", details: %{user_id: id, reason: reason}, module: __MODULE__)
Logger.info("ORDER_CREATED", order_id: order.id, user_id: user.id)
Logger.warning("RATE_LIMIT_EXCEEDED", ip: ip, path: path)

# bad
Logger.error("something went wrong: #{inspect(reason)}")
Logger.error("Error fetching user")
```

Never log secrets, tokens, passwords, or PII. When logging params, censor sensitive fields before logging.
