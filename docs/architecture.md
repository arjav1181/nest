# Event protocol

All agent activity is emitted as events over SSE (`GET /api/runs/{id}/events`).

```json
{ "id": "ab12cd34", "type": "tool_call", "data": { "name": "web_search", "args": {"q": "..."} }, "ts": "2026-10-06T09:00:00Z" }
```

Event types: `thought`, `tool_call`, `tool_result`, `message`, `error`, `done`.

## Runtimes

- `hermes` — Hermes Agent CLI (`hermes run --json`), used when the `hermes`
  binary is on PATH.
- `demo` — deterministic local loop so the UI works with zero setup.
