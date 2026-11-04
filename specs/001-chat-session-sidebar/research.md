# Research: Chat Session Sidebar

Phase 0 output for [plan.md](./plan.md). The Technical Context had no open questions. This
file records the design decisions and why each was made.

## R1. How to scope the list to "this browser" (FR-002)

- **Decision**: the frontend keeps the IDs of conversations started in this browser in
  `localStorage` and sends them to a new read-only endpoint, `GET /api/sessions?ids=…`. The
  endpoint returns summaries for those IDs only.
- **Rationale**: there's no schema change, no change to `POST /api/chat`, and no new
  concept of client identity on the server, which suits Principle V. The browser's ID list
  is the scope, which is exactly what the spec asks for. Unknown IDs are ignored.
  Conversations without messages don't exist on the server, because sessions are created
  with their first message, so FR-008 holds without extra work.
- **Alternatives considered**:
  - *A client ID per browser, stored on `sessions`* (new nullable column plus a new optional
    `client_id` on `POST /api/chat`): the server could list sessions without the browser
    sending IDs. Rejected for now because it needs a migration and a change to the chat
    contract for the same user-visible result. Both approaches lose the list when browser
    data is cleared. Worth revisiting when user login replaces browser scoping.
  - *List every session*: rejected by the answer to Q1. Other people's chats would be
    visible.
  - *Keep the summaries in `localStorage` too*: rejected. Labels and last-active times
    would go stale and differ from the stored data, and continuing a conversation from
    another tab wouldn't update them.

## R2. Shape of the sessions endpoint

- **Decision**: `GET /api/sessions?ids=<id>&ids=<id>…` (the query parameter repeats). It
  accepts at most 200 IDs and returns `{"sessions": [...]}` sorted by `last_active_at`,
  newest first. The full shape is in [contracts/sessions-api.md](./contracts/sessions-api.md).
- **Rationale**: it's a read with no side effects (Principle III), so GET fits. 200 UUIDs
  is about 7.5 KB of query string, well under common URL limits (8 KB or more at the
  proxy and uvicorn). The frontend never sends more than 200 because it caps its stored
  list (R4).
- **Alternatives considered**: `POST /api/sessions/lookup` with a JSON body has no URL
  limit, but a read would no longer look like a read, so it was rejected. A
  comma-separated `ids` value would work, but repeated parameters are FastAPI's built-in
  `list[str]` handling and avoid escaping problems.

## R3. Labels and last-active time

- **Decision**: the server works out both from the existing `messages` table on each
  request. The label is the first `user` message of the conversation, with whitespace
  collapsed and cut to 80 characters plus "…". `last_active_at` is the latest message's
  `created_at`. The UI also cuts the label to one line with CSS ellipsis.
- **Rationale**: no new stored fields and no extra write paths, so nothing can go out of
  sync. With at most 200 sessions and an index on `messages.session_id`, this is one
  grouped query plus a correlated subquery, which comfortably meets SC-003. It works the
  same on SQLite (tests) and on Postgres 14 and 17.
- **Alternatives considered**: store `title` and `last_active_at` columns on `sessions`.
  That's faster at large scale, but it needs a migration and must be updated on every
  chat. Not justified for the POC.

## R4. Keeping the browser's conversation list

- **Decision**: store a JSON array of session IDs, most recent first, in `localStorage`
  under `convai.sessionIds`. Add or move an ID to the front after each successful send.
  Keep at most 200 IDs, dropping the oldest. Wrap every read and write in try/catch. If
  storage is unavailable, keep the list in memory, so the sidebar still works for that
  tab.
- **Rationale**: this meets FR-010 (the list survives a reload) and the browser-scoped
  edge cases. The 200 cap keeps the R2 query bounded.
- **Alternatives considered**: IndexedDB is more than this needs. A cookie would add
  about 7 KB to every request.

## R5. Page load, "New chat" and replies that arrive late

- **Decision**:
  - On page load the app opens a new empty chat with a fresh ID, as it does today, and the
    sidebar lists past conversations.
  - "New chat" makes a new ID locally. Nothing reaches the server until the first message
    is sent (FR-008).
  - Each send remembers the ID of the conversation it was sent from. When the reply
    arrives, it's shown only if that conversation is still open. The sidebar refreshes
    after every completed send.
- **Rationale**: this covers the "switching while a reply is pending" edge case. The
  server already saves both messages to the right conversation in one transaction
  (Principle III), so the client only has to avoid showing the reply in the wrong place.
- **Alternatives considered**: reopening the most recent conversation on load. Rejected
  because the spec doesn't ask for it and today's behaviour (a fresh chat) is kept.

## R6. Frontend testing (Principle IV)

- **Decision**: add `vitest`, `jsdom` and `@testing-library/react` as frontend
  **dev** dependencies. Use them for automated tests of the storage helper, the sidebar
  and the App flows (reopen, continue, new chat, late reply, error and retry), with
  `fetch` mocked. The backend contract stays covered by pytest.
- **Rationale**: Principle IV requires an automated test for each behaviour in the spec,
  and most of this feature is frontend behaviour. The frontend has no test tooling yet.
  Vitest reuses the existing Vite config. These are dev-only and add nothing to the
  runtime bundle, but they're still listed in Complexity Tracking.
- **Alternatives considered**: manual checks only, which would break Principle IV.
  Playwright end-to-end tests, which are heavier and need a browser install and running
  servers. That goes against "tests run without external services".

## R7. Narrow screens

- **Decision**: one stylesheet, `frontend/src/styles.css`, with a media query. At 640 px
  wide or less, the sidebar is hidden behind a "Chats" toggle button. Above that it sits
  as a fixed-width column on the left.
- **Rationale**: inline styles can't contain media queries. One small CSS file is the
  least added structure and needs no new library.
