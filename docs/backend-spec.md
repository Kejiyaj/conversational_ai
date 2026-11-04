# Backend Extension Spec

Extends `backend/` (FastAPI). The FE ↔ BE contract in `README.md` is unchanged:
`POST /api/chat` request/response shapes and `GET /api/health` stay as they are.

## 1. Persistence (Postgres, SQLAlchemy + Alembic)

| Table      | Columns |
|------------|---------|
| `sessions` | `id` (text, PK, client-supplied `session_id`), `created_at` (timestamptz, default now) |
| `messages` | `id` (bigint identity, PK), `session_id` (FK → `sessions.id`, indexed), `role` (`user` \| `assistant`, check constraint), `content` (text, not null), `intent` (text, null), `latency_ms` (int, null), `source` (`agent` \| `mock`, null, check constraint), `created_at` (timestamptz, default now) |

`source` is set only on `assistant` rows. It is null on `user` rows.

- Session rows are created lazily on the first message for an unseen `session_id`.
- Schema is managed only by Alembic (`backend/alembic/`). Initial migration creates both tables. The container runs `alembic upgrade head` before starting uvicorn.
- Sync SQLAlchemy 2.x with the existing `psycopg` driver. `DATABASE_URL` is rewritten to `postgresql+psycopg://` in code, so `docker-compose.yml` and `.env.example` need no changes.
- New deps: `sqlalchemy`, `alembic`.

## 2. `POST /api/chat`

1. Reject empty or whitespace-only `message` with 400 (see §4).
2. Get or create the session, then store the user message (`role=user`).
3. If `AGENT_URL` is set, call it with `httpx` (10s timeout) using `{"prompt": message, "session_id": session_id}`. Expect `{"reply", "intent"}`. `latency_ms` is the measured round-trip time, and `source=agent`.
4. If `AGENT_URL` is empty, or the call fails (timeout, connection error, non-2xx, malformed body), log a warning with the reason and return the existing mock reply `(mock) You said: <message>`. The mock reply has `intent=null`, `latency_ms=null` and `source=mock`.
5. Store the reply (`role=assistant`, with `intent`, `latency_ms` and `source`) and return `{session_id, reply, intent}`.

Both messages are committed in one transaction after the reply is known, so a crash mid-request leaves no orphaned user message.

> Later change: spec 002 (`specs/002-answer-feedback/`) adds a `message_id` field to this response and a feedback endpoint.

## 3. `GET /api/chat/{session_id}/history`

Returns the session's messages ordered by `created_at, id` ascending:

```json
{ "session_id": "string",
  "messages": [ { "id": 1, "role": "user|assistant", "content": "string",
                  "intent": "string | null", "latency_ms": 123,
                  "source": "agent | mock | null", "created_at": "ISO-8601" } ] }
```

An unknown `session_id` returns 200 with `"messages": []`. The history endpoint does not create a session.

## 4. Errors

| Case | Status |
|------|--------|
| Empty or whitespace-only `message` | 400 `{"detail": "message must not be empty"}` |
| Agent failure | Not an error. Falls back to mock (§2) and returns 200. |
| DB unavailable | 500 (default FastAPI handling) |

## Decisions

- **`AGENT_URL` format.** It is the full URL (`http://localhost:8080/invocations`), as in the current code, README and `.env.example`. The backend does not append `/invocations`.
- **Empty `session_id`.** Returns 400, handled the same way as an empty message.
- **400, not 422.** Pydantic `min_length=1` would return 422, so the handler validates explicitly (or overrides the validation handler) to return 400.
