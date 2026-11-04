# Quickstart: Validate the Chat Session Sidebar

This guide proves the feature works from end to end. The API shape is in
[contracts/sessions-api.md](./contracts/sessions-api.md), and the derived fields are
described in [data-model.md](./data-model.md).

## Prerequisites

- Local Postgres has the `convai` database, and the migrations are applied
  (`cd backend && DATABASE_URL=postgresql://app:app@localhost:5432/convai .venv/bin/alembic upgrade head`).
- Backend dependencies are in `backend/.venv`, and frontend dependencies are installed
  (`cd frontend && npm install`).

## 1. Automated tests

```bash
cd backend && .venv/bin/pytest          # includes the new sessions-endpoint tests
cd frontend && npm test                 # vitest: storage helper, sidebar, App flows
```

Expected result: both suites pass with no network, Postgres or AWS access.

## 2. Run the app

```bash
cd backend && DATABASE_URL=postgresql://app:app@localhost:5432/convai .venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev              # http://localhost:5173
```

## 3. API check

Run these after sending at least one chat in the UI. Replace `<id>` with the ID stored in
`localStorage["convai.sessionIds"]`.

```bash
curl -s 'localhost:8000/api/sessions?ids=<id>&ids=does-not-exist'
# → one entry for <id>; nothing for does-not-exist

curl -s -o /dev/null -w '%{http_code}\n' "localhost:8000/api/sessions?$(python3 -c "print('&'.join(f'ids=x{i}' for i in range(201)))")"
# → 400
```

## 4. Manual scenarios (map to the spec)

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open the app in a fresh browser profile | The sidebar shows the empty state, and you can chat right away |
| 2 | Send "first topic", choose **New chat**, send "second topic" | The sidebar lists "second topic" above "first topic". The open chat is highlighted (US1, US3) |
| 3 | Choose **New chat** but don't send anything | No new sidebar entry appears (FR-008) |
| 4 | Reload the page and select "first topic" | All of its messages appear in their original order (US1, FR-010, SC-002) |
| 5 | In the reopened "first topic", send "follow-up" | The reply is added to that conversation, and it moves to the top of the sidebar (US2) |
| 6 | Send a message, then switch to another chat before the reply arrives | The reply doesn't appear in the other chat. Reopening the original chat shows it (edge case) |
| 7 | Stop the backend and select a conversation | An error with **Retry** appears, and the current chat stays visible. Start the backend and choose Retry, and the conversation loads (FR-011) |
| 8 | Send a 300-character first message | The sidebar label stays on one line with an ellipsis |
| 9 | Narrow the window to 640 px or less | The sidebar collapses behind a **Chats** toggle, and the chat input stays usable |
| 10 | Open the app in a different browser | Conversations from the first browser aren't listed (FR-002) |
