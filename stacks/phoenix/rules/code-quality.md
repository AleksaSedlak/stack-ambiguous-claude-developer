---
alwaysApply: true
---

# Code Quality

## Principles

- Functions do one thing. If it needs a section comment, extract that section.
- No magic values — extract numbers, strings, and config to named module attributes.
- Handle errors at the boundary. Don't match and re-raise without adding context.
- No premature abstractions. Three similar lines > a helper used once.
- Don't add features or "improve" things beyond what was asked.
- No dead code or commented-out blocks. Git has history.

## Naming

- **Files**: `snake_case.ex` always — `user_account.ex`, `billing_context.ex`
- **Modules**: PascalCase matching the file path — `MyApp.UserAccount`
- **Functions**: `snake_case`, verb-first — `get_user/1`, `validate_email/1`, `handle_message/2`
- **Booleans**: `is_` or `has_` prefix — `is_valid?/1`, `has_permission?/2`
- **Predicates**: end with `?` — `valid?/1`, `admin?/1`
- **Bang functions**: end with `!`, raise on error — `get_user!/1`
- **Atoms**: for internal values and return tags — `:ok`, `:error`, `:active`, `:pending`
- **Module attributes**: for constants — `@max_retries 3`, `@default_timeout 5_000`
- **Abbreviations**: only universally known (`id`, `url`, `api`, `db`, `config`, `auth`, `repo`)

## Specs

Every public function (`def`) must have a `@spec`. No exceptions.

```elixir
@spec get_user(integer()) :: {:ok, User.t()} | {:error, :not_found}
def get_user(id) do
  ...
end
```

- Place `@spec` immediately before `@doc` (if present) or the function definition.
- Use `@type` to define custom types in the module — don't inline complex types in specs.
- Private functions (`defp`) do not require `@spec`, but add one if the function is complex.

## Module Structure

Order within a module:

1. `@moduledoc`
2. `use` / `import` / `alias` / `require` — one per line, alphabetical within each group
3. `@type` definitions
4. Module attributes (`@constant_name value`)
5. Public functions (`def`) with `@doc` and `@spec`
6. Private functions (`defp`) in call order — top-to-bottom reads as a story

## Patterns

**Prefer pattern matching over conditionals:**
```elixir
# good
def process({:ok, value}), do: ...
def process({:error, reason}), do: ...

# avoid
def process(result) do
  if elem(result, 0) == :ok, do: ...
end
```

**Use `with` for sequential operations that can fail:**
```elixir
# good
with {:ok, user} <- fetch_user(id),
     {:ok, account} <- fetch_account(user.account_id) do
  {:ok, {user, account}}
end

# avoid
case fetch_user(id) do
  {:ok, user} ->
    case fetch_account(user.account_id) do
      ...
    end
end
```

**Use pipe `|>` for transformation pipelines, not for everything:**
```elixir
# good — clear transformation chain
result =
  raw_input
  |> String.trim()
  |> String.downcase()
  |> validate_format()

# avoid — pipe used for a single step
user |> get_name()
```

## Comments

- **WHY**, never WHAT. If the code needs a "what" comment, rename instead.
- `@moduledoc` on every module. `@doc` on every public function.
- Comment non-obvious decisions, workarounds with issue links, complex algorithm steps.
- No commented-out code — delete it. No journal comments — git blame does this.

## Code Markers

| Marker | Use |
|---|---|
| `# TODO(author): desc (#issue)` | Planned work |
| `# FIXME(author): desc (#issue)` | Known bugs |
| `# HACK(author): desc (#issue)` | Ugly workarounds (explain the proper fix) |
| `# NOTE: desc` | Non-obvious context for future readers |

Must have an owner + issue link. Don't commit TODOs you can do now.
