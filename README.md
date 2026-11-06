# Conversational AI — POC

Chat app (ChatGPT-like) → FastAPI backend → AWS Bedrock AgentCore agent that captures customer intent.

| Folder      | What                              | Owner  |
|-------------|-----------------------------------|--------|
| `frontend/` | Website and mobile app, with shared packages | Vinod  |
| `backend/`  | FastAPI + Postgres                | Rajesh |
| `agent/`    | AgentCore agent (needs R Systems AWS + AgentCore access) | TBD |

## API contract (FE ↔ BE)

`POST /api/chat`
```json
// request
{ "session_id": "string", "message": "string" }
// response
{ "session_id": "string", "reply": "string", "intent": "string | null", "message_id": "integer | null" }
```
`message_id` is the id of the assistant message created for this reply, and it is the id to rate with the feedback
endpoint below. It is always an integer today. Clients that don't use it can ignore it.

`POST /api/messages/{message_id}/feedback`: rate one assistant message. Submitting again for the same message replaces
the earlier feedback.
```json
// request: rating is required; reason (only with "down") and comment (max 1000 chars) are optional
{ "rating": "up | down", "reason": "incorrect | unclear | wanted_a_person | other", "comment": "string" }
// response 200 (created or replaced)
{ "message_id": 42, "rating": "down", "reason": "string | null", "comment": "string | null",
  "trace_id": null, "created_at": "ISO-8601", "updated_at": "ISO-8601" }
```
`trace_id` is always `null` until agent tracing exists, and the reason list is provisional (pending approval).
Invalid input returns 400 `{"detail": "<message>"}` and stores nothing: a `message_id` that isn't a positive whole
number, a body that isn't a JSON object, a bad `rating`, `reason` or `comment`, `reason` with `"up"`, or a user
message (only assistant messages can be rated). An unknown message returns 404 `{"detail": "message not found"}`.
See `specs/002-answer-feedback/contracts/feedback-api.md` for the exact messages.

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
cd frontend && npm install && npm run web   # http://localhost:5173 (proxies /api to :8000)

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

## Agent: local wealth agent (Strands + Ollama)

Spec: `specs/005-wealth-agent/`. Runs fully locally against Ollama (`llama3.2` by default); synthetic data, read-only tools.

```bash
ollama pull llama3.2 && ollama serve          # http://localhost:11434
cd agent
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt
pytest                                        # unit tests, no Ollama needed
PYTHONPATH=src python -m wealth_agent         # interactive chat
PYTHONPATH=src python evals/run_eval.py       # live golden-case eval (needs Ollama)
```

Config: `WEALTH_AGENT_PROVIDER` (only `ollama`), `OLLAMA_HOST`, `OLLAMA_MODEL`.

## Frontend: structure

`frontend/` is one npm workspace, so run `npm install` once in `frontend/`. If you have an older checkout, delete
`frontend/node_modules` first. Apps run things and packages share things: apps can import packages, and packages never
import apps.

| Folder | What lives there |
|--------|------------------|
| `apps/web/` | The website (Vite): screens, browser services, tests |
| `apps/mobile/` | The mobile app (Expo, React Native): starter screen for now |
| `packages/ui/` | Shared components. `src/button/` has web and native files; `src/web/` holds web-only components |
| `packages/core/` | API client and types, and text parsing. No UI or platform code |
| `packages/tokens/` | Brand colours in `tokens.json`, and the CSS generated from them |

Commands, from `frontend/`:

| Command | What it does |
|---------|--------------|
| `npm run web` | Starts the website |
| `npm run mobile` | Starts the Expo dev server (needs a simulator, or Expo Go on a device) |
| `npm test` | Runs all tests. Fetch is mocked, and no backend or simulator is needed |
| `npm run build` | Type checks and builds the website, and type checks the mobile app |
| `npm run bundle:mobile` | Checks that the mobile app bundles for iOS and Android |
| `npm run tokens` | Regenerates the theme CSS after a change to `tokens.json` |

The mobile app must call `configureApi({ baseUrl })` from `@convai/core` before using the API, because a native app has
no page origin. The website keeps the relative `/api` path.

## Frontend: UI kit and theme

- UI components are [shadcn](https://ui.shadcn.com) (Radix variant) with
  [AI Elements](https://ui.shadcn.com/docs/ai-elements) for the chat. Generated components live in
  `frontend/packages/ui/src/web/` and are ours to edit.
- Add a component: `cd frontend/packages/ui && npx shadcn@latest add <name>`, then change any `@/web/<name>` import in
  the new file to `@convai/ui/<name>`. Import it anywhere as `@convai/ui/<name>`.
- Web-only components fail at type check and bundling if imported in the mobile app. To port one, move it to
  `packages/ui/src/<name>/` with shared types and web and native files, and add it to `exports` in
  `packages/ui/package.json`. See `specs/007-shared-ui-library/contracts/`.
- Brand values (Principal theme) live only in `frontend/packages/tokens/tokens.json`. Components use
  shadcn variables (`bg-primary`, `text-foreground` and so on), never hard-coded colors; a test enforces this.
  See `specs/003-shadcn-ai-elements/contracts/theme-tokens.md`.
- Answer feedback: thumbs up/down, an optional reason and a comment under each reply, sent to
  `POST /api/messages/{message_id}/feedback` (spec 002). Ratings are shown for the current visit only;
  history does not return them yet. See `specs/004-answer-feedback-ui/`.

## Feature development (Spec Kit)

New features use [Spec Kit](https://github.com/github/spec-kit), in Claude Code, from the repo root.
Project rules live in `.specify/memory/constitution.md`, and each feature's artifacts are written to `specs/<feature>/`.

1. `/speckit-specify <what you want and why>`: writes the feature spec to `specs/<feature>/spec.md`. Create your feature branch first.
2. `/speckit-clarify` (optional): answers open questions in the spec.
3. `/speckit-plan <tech notes>`: produces the implementation plan and checks it against the constitution.
4. `/speckit-tasks`: breaks the plan into ordered tasks. Run `/speckit-analyze` (optional) to check consistency.
5. `/speckit-implement`: builds the feature from the tasks.

Review the generated spec and plan before moving to the next step.

### End to end with `/pdlc`

`/pdlc` runs the whole flow from a requirement to a pull request. It reads the requirement from Confluence or Jira, then
writes the spec, gets the Figma design (or proposes one), plans, creates Jira tickets, builds with tests first, verifies
and opens the PR. It stops for your approval at the spec, design, plan, Jira and PR steps.

```text
/pdlc https://<org>.atlassian.net/wiki/spaces/…/pages/…    # from a Confluence page
/pdlc CONVAI-123                                            # from an existing Jira ticket
/pdlc CONVAI-123 https://www.figma.com/design/…             # with a Figma link
/pdlc resume                                                # continue the run on this branch
```

- Steps: `.pdlc/PLAYBOOK.md`. Settings (Jira project, issue types, statuses, custom fields, Figma, branches, verify
  commands, gates): `.pdlc/config.yaml`. No secrets: Confluence, Jira and Figma sign in through their MCP servers.
- Works in Claude Code (`/pdlc`), Cursor (`/pdlc`, MCP servers in `.cursor/mcp.json`) and GitHub Copilot in VS Code
  (`/pdlc` prompt, MCP servers in `.vscode/mcp.json`).
- In Claude Code, a hook (`.pdlc/hooks/guard.py`) blocks pushes to `main` and blocks opening a PR before verify passes.
  Test it with `python3 -m unittest discover -s .pdlc/hooks`.
- Opening the PR uses the GitHub CLI: `brew install gh && gh auth login`. If an API contract changes, update the contract section above in the same PR.
