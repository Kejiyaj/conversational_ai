# Quickstart: Validate Answer Feedback

This guide proves the feature works from end to end. The API shape is in
[contracts/feedback-api.md](./contracts/feedback-api.md), and the table is described in
[data-model.md](./data-model.md).

## Prerequisites

- Docker is running. Nothing else is needed for the API checks.
- The curl sequence below uses message ids 1 and 2, which is what a fresh database gives. To
  start fresh, run `docker compose down -v` first. This deletes all Postgres data. On an
  existing database, use the `message_id` the chat call returns instead of 2, and the id of
  the user message instead of 1.
- For the automated tests: a Python 3.12 venv in `backend/` with `requirements-dev.txt`
  installed (see the README, "Backend: run and test").

## 1. Automated tests

```bash
cd backend && pytest
```

Expected result: all tests pass with no Postgres, network or AWS access. That includes the
existing suite and the new feedback tests listed in the contract's test obligations.

## 2. Start the stack and check the migration

```bash
docker compose up --build -d
docker compose logs backend | grep -i "running upgrade"     # → ... 0001 -> 0002
docker compose exec backend alembic check                   # → No new upgrade operations detected.
docker compose exec db psql -U app -d convai -c '\d feedback'
```

Expected: the `feedback` table has the columns, the unique constraint on `message_id`, the two
check constraints and the foreign key from the data model.

Optional round trip, to prove the migration reverses cleanly:

```bash
docker compose exec backend alembic downgrade -1 && docker compose exec backend alembic upgrade head
```

The constitution requires the migration to work on Postgres 14 as well as 17 (the Docker
image). Check 14 with a temporary container, or with a local Postgres 14 if you have one:

```bash
docker run -d --rm --name convai-pg14 -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=convai -p 5434:5432 postgres:14
until docker exec convai-pg14 pg_isready -U app -d convai; do sleep 1; done
cd backend
DATABASE_URL=postgresql://app:app@localhost:5434/convai alembic upgrade head   # → ... 0001 -> 0002
DATABASE_URL=postgresql://app:app@localhost:5434/convai alembic check          # → No new upgrade operations detected.
docker rm -f convai-pg14
```

## 3. API check

```bash
J='content-type: application/json'

# Chat: the reply now carries message_id (the assistant message)
curl -s -X POST localhost:8000/api/chat -H "$J" -d '{"session_id":"fb-demo","message":"hello"}'
# → {"session_id":"fb-demo","reply":"(mock) You said: hello","intent":null,"message_id":2}
#   (message_id is an integer today; the contract types it integer | null)
# (use the message_id you get back below; it is 2 on a fresh database)

# Rate up, then change to down with a reason and a comment (one row, replaced)
curl -s -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"up"}'
curl -s -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"down","reason":"unclear","comment":"Too vague"}'

# Identical resubmission: 200, and updated_at doesn't move (the two selects print the same value)
docker compose exec db psql -U app -d convai -tc "select updated_at from feedback where message_id = 2"
curl -s -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"down","reason":"unclear","comment":"Too vague"}'
docker compose exec db psql -U app -d convai -tc "select updated_at from feedback where message_id = 2"

# Refusals (each prints the status and the detail)
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/1/feedback -H "$J" -d '{"rating":"up"}'                 # user message → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/999/feedback -H "$J" -d '{"rating":"up"}'               # unknown → 404
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/abc/feedback -H "$J" -d '{"rating":"up"}'               # not a positive whole number → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/0/feedback -H "$J" -d '{"rating":"up"}'                 # zero → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"Up"}'                 # bad rating → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"up","reason":"incorrect"}'   # reason with up → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"down","reason":"wrong"}'     # unlisted reason → 400
curl -s -w ' [%{http_code}]\n' -X POST localhost:8000/api/messages/2/feedback -H "$J" -d 'not json'                        # bad body → 400

# A trace_id sent by a client is ignored
curl -s -X POST localhost:8000/api/messages/2/feedback -H "$J" -d '{"rating":"down","trace_id":"abc"}'   # → "trace_id":null

# History is unchanged: no feedback in it
curl -s localhost:8000/api/chat/fb-demo/history | python3 -m json.tool

# What is stored: exactly one row for message 2
docker compose exec db psql -U app -d convai -c "select message_id, rating, reason, comment, trace_id, created_at, updated_at from feedback"
```

Expected: after the last rating call, the table shows one row, for message 2, with rating
`down` and no reason and no comment (the last submission omitted them). The refusals leave
the table as it was.

## 4. Manual scenarios (map to the spec)

| # | Steps | Expected |
|---|-------|----------|
| 1 | Send a chat message and read `message_id` from the reply | The id equals the assistant row's id in `GET /api/chat/{session_id}/history` (US1) |
| 2 | Rate that id "up", then "down" with reason `incorrect` and a comment | One feedback row, holding the last values (US1, US3, US4, US5) |
| 3 | Rate the id of the user message | 400, and no row is created (US2) |
| 4 | Rate a mock reply (the default when `AGENT_URL` is empty) | Accepted. The row's message has `source = 'mock'` (FR-009) |
| 5 | Submit a comment of 1000 characters, then 1001 | 1000 is accepted and 1001 returns 400 (FR-006) |
| 6 | Run the chat flow from the frontend (`npm run dev`) | Chat works as before. The extra `message_id` in the response changes nothing in the UI |
