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
