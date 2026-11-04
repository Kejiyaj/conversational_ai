# Contract: Frontend ↔ Backend for the Chat Session Sidebar

This contract **adds** one endpoint. Existing endpoints are not changed. Under Principle I,
this is an additive change: the frontend and backend owners both review it, and `README.md`
is updated in the same PR.

## New: `GET /api/sessions`

Returns summaries of the requested conversations, so the sidebar can list them.

### Request

| Query parameter | Repeats | Rules |
|-----------------|---------|-------|
| `ids` | yes (`?ids=a&ids=b`) | 0 to 200 values. Values that are empty or only whitespace are ignored. |

### Responses

**200**: sorted by `last_active_at`, newest first. When times are equal, sorted by
`session_id` ascending.

```json
{
  "sessions": [
    {
      "session_id": "3f2c…",
      "title": "How do I reset my router password?",
      "created_at": "2026-11-04T09:12:03.120000+00:00",
      "last_active_at": "2026-11-04T09:15:44.871000+00:00"
    }
  ]
}
```

- `title` is the conversation's first user message with whitespace collapsed. It is at
  most 80 characters plus "…".
- IDs that don't exist are left out. They don't cause an error.
- With no `ids`, or only empty ones, the response is `{"sessions": []}`.
- Duplicate IDs return one entry each.
- The endpoint has no side effects. It never creates sessions (Principle III).

**400**: more than 200 `ids` values.

```json
{ "detail": "too many session ids (max 200)" }
```

**500**: database unavailable (FastAPI's default handling, as for the other endpoints).

## Existing endpoints this feature uses (unchanged)

| Endpoint | Used for |
|----------|----------|
| `GET /api/chat/{session_id}/history` | Reopening a conversation (FR-005, FR-012). It returns every message ordered by `created_at, id`, including `source` (`agent` or `mock`). |
| `POST /api/chat` | Continuing a reopened conversation by sending its `session_id` (FR-006), and starting a new one with a fresh ID (FR-007). |

## Test obligations (Principle IV)

The backend pytest suite MUST cover each of these:

1. Requested IDs are returned with the right `title` and `last_active_at`.
2. The order is newest first, and continuing an older session moves it to the top.
3. Unknown IDs are left out, and IDs that weren't requested are never returned.
4. No `ids` returns an empty list.
5. More than 200 `ids` returns 400 with the `detail` above.
6. Long or multi-line first messages give a title of at most 80 characters plus "…".
7. Calling the endpoint creates no rows.
