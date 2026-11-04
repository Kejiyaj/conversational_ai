# Data Model: Chat Session Sidebar

**Schema changes: none.** This feature only reads the existing `sessions` and `messages`
tables, which the migration `backend/alembic/versions/0001_create_sessions_and_messages.py`
created. No Alembic migration is needed.

## Stored entities (unchanged)

| Entity | Table | Fields this feature uses |
|--------|-------|--------------------------|
| Conversation | `sessions` | `id` (client-supplied session ID), `created_at` |
| Message | `messages` | `session_id`, `role` (`user` or `assistant`), `content`, `created_at`, `id` (tie-break) |

A conversation always has at least two messages, because the session row is created in the
same transaction as the first user message and its reply. Because of that, every session
returned by the list endpoint already meets FR-008.

## Derived view: SessionSummary (API only, not stored)

Built for each request by `GET /api/sessions`
(see [contracts/sessions-api.md](./contracts/sessions-api.md)).

| Field | Type | Derivation |
|-------|------|------------|
| `session_id` | string | `sessions.id` |
| `title` | string | First message with `role = 'user'`, ordered by `created_at, id`. Whitespace runs collapse to single spaces and the text is trimmed. If it is longer than 80 characters, it is cut to 80 and "…" is added. |
| `created_at` | ISO-8601 datetime | `sessions.created_at` |
| `last_active_at` | ISO-8601 datetime | `MAX(messages.created_at)` for the session |

Rules:

- Only sessions whose `id` is among the requested IDs **and** that exist in the database are
  returned. Unknown IDs are silently left out.
- Results are sorted by `last_active_at` descending, and then by `session_id` ascending so
  the order is fixed when times are equal.
- Duplicate requested IDs return one entry.

## Client-side state (frontend only, not stored on the server)

| Item | Where | Shape and rules |
|------|-------|-----------------|
| Known session IDs | `localStorage["convai.sessionIds"]` | JSON array of strings, most recent first, without duplicates, at most 200 entries. An ID is added or moved to the front after a send succeeds. If the stored value is unreadable or malformed, it is treated as `[]`. If storage is unavailable, an in-memory copy is used instead. |
| Active session ID | React state | A fresh UUID on page load and on "New chat". Set to the chosen ID when the user reopens a conversation. |
| Pending send | React state or ref | Remembers which session ID the send came from, so a late reply is shown only if that session is still open. |

### Active conversation states

```text
new (fresh ID, no messages, not in sidebar)
  └─ first send succeeds ──► saved (in sidebar, at the top)
saved ──select in sidebar──► open (history loaded)
open ──send succeeds──► open (moves to the top of the sidebar)
any ──"New chat"──► new
```
