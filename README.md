# Conversational AI — POC

Chat app (ChatGPT-like) → FastAPI backend → AWS Bedrock AgentCore agent that captures customer intent.

| Folder      | What                              | Owner  |
|-------------|-----------------------------------|--------|
| `frontend/` | React (Vite + TS) chat UI         | Vinod  |
| `backend/`  | FastAPI + Postgres                | Rajesh |
| `agent/`    | AgentCore agent (needs R Systems AWS + AgentCore access) | TBD |

## API contract (FE ↔ BE)

`POST /api/chat`
```json
// request
{ "session_id": "string", "message": "string" }
// response
{ "session_id": "string", "reply": "string", "intent": "string | null" }
```

`GET /api/chat/{session_id}/history`: every message in the session, oldest first. An unknown session returns `"messages": []`.
```json
{ "session_id": "string",
  "messages": [ { "id": 1, "role": "user | assistant", "content": "string",
                  "intent": "string | null", "latency_ms": "number | null",
                  "source": "agent | mock | null", "created_at": "ISO-8601" } ] }
```

`GET /api/sessions?ids=<id>&ids=<id>…`: summaries of the given sessions for the sidebar, most recently active first.
The frontend sends the session IDs this browser has used. Unknown IDs are skipped, and more than 200 IDs returns
400 `{"detail": "too many session ids (max 200)"}`.
```json
{ "sessions": [ { "session_id": "string", "title": "first user message (max 80 chars + …)",
                  "created_at": "ISO-8601", "last_active_at": "ISO-8601" } ] }
```

`GET /api/health` → `{ "status": "ok" }`

The backend calls the agent with `{ "prompt": "<message>", "session_id": "..." }` and expects
`{ "reply": "...", "intent": "..." }` back. Until AgentCore access is ready, the backend returns a mock reply.

## Run locally

```bash
# Postgres + backend
docker compose up --build        # backend on http://localhost:8000

# Frontend
cd frontend && npm install && npm run dev   # http://localhost:5173 (proxies /api to :8000)

# Agent (once AWS access is set up)
cd agent && uv run agent.py      # local AgentCore runtime on http://localhost:8080
```

## Backend: run and test

```bash
# Run (Postgres + backend; migrations run on startup)
docker compose up --build

# Test (no Postgres needed; uses in-memory SQLite)
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest
```

## Frontend: test

```bash
cd frontend && npm install && npm test   # vitest + jsdom, fetch is mocked (no backend needed)
```

## Feature development (Spec Kit)

New features use [Spec Kit](https://github.com/github/spec-kit), in Claude Code, from the repo root.
Project rules live in `.specify/memory/constitution.md`, and each feature's artifacts are written to `specs/<feature>/`.

1. `/speckit-specify <what you want and why>`: writes the feature spec to `specs/<feature>/spec.md`. Create your feature branch first.
2. `/speckit-clarify` (optional): answers open questions in the spec.
3. `/speckit-plan <tech notes>`: produces the implementation plan and checks it against the constitution.
4. `/speckit-tasks`: breaks the plan into ordered tasks. Run `/speckit-analyze` (optional) to check consistency.
5. `/speckit-implement`: builds the feature from the tasks.

Review the generated spec and plan before moving to the next step. If an API contract changes, update the contract section above in the same PR.
