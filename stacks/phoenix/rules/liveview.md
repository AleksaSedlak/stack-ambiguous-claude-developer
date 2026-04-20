---
paths:
  - "lib/**_web/live/**"
  - "lib/**_web/components/**"
  - "lib/**_web/controllers/**"
  - "**/*.heex"
---

# Phoenix LiveView

## LiveView Module Structure

Each callback has one responsibility — do not mix concerns:

- `mount/3` — initialize assigns, subscribe to PubSub, set defaults. Never do slow work directly; use `connected?/1` to defer until WebSocket is established.
- `handle_params/3` — react to URL parameter changes and navigation.
- `handle_event/3` — thin event handlers. Call a context function, assign the result. No business logic here.
- `render/1` — pure HEEx template. No conditionals beyond `if/unless`, no function calls beyond helpers.

```elixir
def mount(_params, _session, socket) do
  if connected?(socket) do
    Phoenix.PubSub.subscribe(MyApp.PubSub, "orders")
  end
  {:ok, assign(socket, orders: [])}
end

def handle_event("create_order", params, socket) do
  case Orders.create(params) do
    {:ok, order} -> {:noreply, stream_insert(socket, :orders, order)}
    {:error, changeset} -> {:noreply, assign(socket, form: to_form(changeset))}
  end
end
```

## Assigns

- Only assign what the template needs — no complex domain structs in assigns.
- Use `assign_new/3` for values that should be computed once and not overwritten on re-render.
- Use `stream/3` for large or paginated lists — never load all records into assigns.
- Do not put secrets or sensitive data in assigns — they are accessible to the client through the socket.

## Components

- Use function components (`def my_component(assigns)`) for stateless, reusable UI pieces.
- Use `live_component` only when local state or lifecycle callbacks are required.
- Shared UI primitives belong in `core_components.ex` — do not duplicate across LiveViews.

## HEEx Templates

- Never use `raw/1` or `Phoenix.HTML.raw/1` on user-supplied content — XSS risk.
- Always use verified routes: `~p"/users/#{user.id}"`, never string-concatenated paths.
- Add `phx-debounce` to text input event handlers — do not send an event on every keystroke.
- Keep templates readable — extract complex sections into function components rather than nesting deeply.

## Authentication

- Validate auth in `on_mount` hooks, not inside individual LiveViews.
- Use `{:halt, redirect(socket, to: ~p"/login")}` from `on_mount` to reject unauthenticated access.
- Never trust assigns set before mount — always re-validate from session or DB.

## Accessibility

- All interactive elements must be keyboard-accessible.
- Form inputs must have associated labels.
- Use `aria-live` for dynamic content regions updated by LiveView patches.
