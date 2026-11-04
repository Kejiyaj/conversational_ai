---

description: "Task list for the Chat Session Sidebar feature"
---

# Tasks: Chat Session Sidebar

**Input**: Design documents from `specs/001-chat-session-sidebar/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/sessions-api.md, quickstart.md

**Tests**: Included. Constitution Principle IV requires at least one automated test for each
behaviour and error case in the spec. Backend tests use pytest with in-memory SQLite
(`backend/tests/conftest.py` already provides `client` and `engine` fixtures). Frontend
tests use vitest with jsdom and a mocked `fetch`. Write each test task before its
implementation task and confirm it fails first.

**Organization**: Tasks are grouped by user story so each story can be implemented and
tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

This is a web app: the backend is in `backend/app/` and `backend/tests/`, and the frontend
is in `frontend/src/` and `frontend/src/__tests__/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Frontend test tooling. This is the only new dependency; see plan.md
Complexity Tracking.

- [X] T001 Add dev dependencies `vitest`, `jsdom` and `@testing-library/react` (versions
  compatible with `vite@^8` and `react@^19`) with `npm install -D` in `frontend/`. Add the
  script `"test": "vitest run"` to `frontend/package.json`.
- [X] T002 Configure vitest in `frontend/vite.config.ts`. Add `test: { environment: "jsdom" }`
  next to the existing `plugins` and `server.proxy`, keeping the `/api` proxy unchanged, and
  add the vitest config type reference so `tsc -b` still passes. Check that `npm test` runs,
  with zero tests, and exits 0.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Client-side storage and API helpers that every story uses.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T003 [P] Write tests for the session ID store in
  `frontend/src/__tests__/sessionStore.test.ts`. Cover these cases:
  - Empty storage returns `[]`.
  - `remember(id)` adds the ID at the front, and remembering an existing ID moves it to the
    front without duplicating it.
  - The list is capped at **200** entries, dropping the oldest.
  - A malformed value in `localStorage["convai.sessionIds"]` is treated as `[]`.
  - When `localStorage` throws on read or write, the in-memory fallback still returns
    remembered IDs.
- [X] T004 [P] Implement `frontend/src/sessionStore.ts` with `getSessionIds(): string[]` and
  `rememberSession(id: string): void`.
  - Storage key: `"convai.sessionIds"`.
  - Value: a JSON array of strings, most recent first, without duplicates, at most 200
    entries.
  - Wrap every `localStorage` access in try/catch, and fall back to a module-level
    in-memory array.
  - T003 must pass.
- [X] T005 [P] Create `frontend/src/api.ts` with typed helpers that throw an `Error` on a
  network failure or a non-2xx status:
  - `sendMessage(sessionId, message)` → `POST /api/chat`, returns
    `{ session_id, reply, intent }`. Move the existing fetch logic here from
    `frontend/src/App.tsx`.
  - `getHistory(sessionId)` → `GET /api/chat/{session_id}/history`, returns
    `{ session_id, messages: { id, role, content, intent, latency_ms, source, created_at }[] }`.
  - `listSessions(ids)` → `GET /api/sessions` with one `ids=<id>` query parameter per ID,
    each URL-encoded. Returns `{ sessions: { session_id, title, created_at, last_active_at }[] }`.
    If `ids` is empty, return `{ sessions: [] }` without calling the server.

**Checkpoint**: The foundation is ready, and `npm test` passes in `frontend/`.

---

## Phase 3: User Story 1 - See and reopen a past conversation (Priority: P1) 🎯 MVP

**Goal**: A sidebar lists this browser's past conversations, newest first. Selecting one
shows its full history.

**Independent Test**: Hold two conversations, reload, select the first one in the sidebar.
All of its messages appear in their original order (quickstart.md scenarios 1, 2, 4, 7, 8,
9, 10).

### Tests for User Story 1 ⚠️

> Write these tests first and confirm they fail before implementing.

- [X] T006 [P] [US1] Write backend tests for `GET /api/sessions` in
  `backend/tests/test_sessions.py`, seeding data through `POST /api/chat`. They cover
  contract test points 1 and 3 to 7 (point 2 is added in US2):
  1. Requested IDs return the right `title` (the first user message) and `last_active_at`,
     sorted by `last_active_at` descending.
  2. Unknown IDs are left out, and sessions that weren't requested are never returned.
  3. No `ids`, or only empty or whitespace `ids`, returns `{"sessions": []}`.
  4. 201 `ids` returns 400 with `{"detail": "too many session ids (max 200)"}`, and exactly
     200 returns 200.
  5. A first message with newlines or repeated spaces and more than 80 characters gives a
     collapsed title of 80 characters plus "…". A short title is returned unchanged.
  6. Duplicate IDs return a single entry.
  7. Calling the endpoint doesn't change the row counts in `sessions` or `messages`.
- [X] T007 [P] [US1] Write tests for the sidebar component in
  `frontend/src/__tests__/Sidebar.test.tsx`:
  - It renders sessions in the order given, each showing its `title` and a readable
    last-active time.
  - It shows an empty-state message when there are no sessions.
  - It marks the entry whose `session_id` equals `activeSessionId` (for example with
    `aria-current="true"`).
  - Clicking an entry calls `onSelect(session_id)`.
  - When `error` is set, it shows the message and a **Retry** button that calls `onRetry`.
- [X] T008 [P] [US1] Write App reopen-flow tests in `frontend/src/__tests__/App.test.tsx`,
  mocking `fetch`:
  - With stored IDs in `localStorage["convai.sessionIds"]`, the sidebar loads from
    `/api/sessions` on mount.
  - Clicking an entry loads `/api/chat/{id}/history` and shows every message, user and
    assistant (including `source: "mock"` replies), in the returned order.
  - If the history request fails, an error with Retry appears and the conversation already
    shown stays visible. Retry then loads it.
  - After the first successful send in a fresh chat, the session ID is stored and the
    sidebar refreshes.

### Implementation for User Story 1

- [X] T009 [US1] Implement `GET /api/sessions` in `backend/app/main.py` to match
  `specs/001-chat-session-sidebar/contracts/sessions-api.md`.
  - Add Pydantic models `SessionSummary` (`session_id: str`, `title: str`,
    `created_at: datetime`, `last_active_at: datetime`) and `SessionsResponse`
    (`sessions: list[SessionSummary]`).
  - The handler takes `ids: list[str] = Query(default=[])`.
  - If there are more than 200 values, raise `HTTPException(400, "too many session ids (max 200)")`.
  - Strip the values, drop empty ones and remove duplicates. If none are left, return an
    empty list.
  - Run one query over `messages` filtered by `session_id IN ids`, grouped by `session_id`,
    using `MAX(created_at)` as `last_active_at`. Join `sessions` for `created_at`. Take
    `title` from the first `role = 'user'` message ordered by `created_at, id`, using a
    correlated subquery.
  - Collapse whitespace runs to single spaces and trim. If the result is longer than 80
    characters, keep the first 80 and add "…".
  - Order by `last_active_at` descending, then `session_id` ascending.
  - Don't write anything. The query must work on SQLite and on Postgres 14 and 17.
  - T006 must pass.
- [X] T010 [P] [US1] Create `frontend/src/Sidebar.tsx`.
  - Props: `sessions`, `activeSessionId`, `onSelect(id)`, `onNewChat()` (the button is
    rendered in US3; accept the prop now), `error: string | null`, `onRetry()`, `loading`.
  - It renders a scrollable list with one-line, ellipsised titles, an empty state and an
    error with a Retry button.
  - T007 must pass.
- [X] T011 [P] [US1] Create `frontend/src/styles.css` and import it in
  `frontend/src/main.tsx`.
  - Two-column layout: a fixed-width sidebar of about 260 px that scrolls on its own, and
    the chat area, which keeps the input reachable.
  - `.session-title` uses `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
  - At `max-width: 640px` the sidebar is hidden unless the container has an `open` class.
    A **Chats** toggle button is visible only at that width.
  - Move the existing inline styles from `App.tsx` into classes.
- [X] T012 [US1] Update `frontend/src/App.tsx`. It depends on T004, T005, T010 and T011.
  - Replace the module-level `sessionId` constant with an `activeSessionId` state. It
    starts as `crypto.randomUUID()`, so page load opens a fresh chat.
  - On mount, call `listSessions(getSessionIds())` and keep the result in state.
  - On select, call `getHistory(id)`, map `content` to the message text and show the
    messages in the returned order. Set `activeSessionId` only after the history loads.
  - If the list or the history request fails, set the sidebar `error` and keep the current
    messages. Retry repeats the failed action.
  - After each successful `sendMessage`, call `rememberSession(sessionId)` and refresh the
    sidebar.
  - Render `<Sidebar>` and the **Chats** toggle for narrow screens.
  - T008 must pass.

**Checkpoint**: US1 works on its own. Run quickstart.md scenarios 1, 2 (without "New chat"),
4, 7, 8, 9 and 10.

---

## Phase 4: User Story 2 - Continue a reopened conversation (Priority: P2)

**Goal**: Messages sent in a reopened conversation are added to it, and that conversation
moves to the top of the sidebar.

**Independent Test**: Reopen a past conversation, send a message, reload and reopen it. The
new message and its reply are at the end (quickstart.md scenarios 5 and 6).

### Tests for User Story 2 ⚠️

- [X] T013 [P] [US2] Add contract test point 2 to `backend/tests/test_sessions.py`. Create
  sessions A and then B, send another message to A, and check that `GET /api/sessions?ids=A&ids=B`
  returns A first. Because both rows may have equal timestamps on SQLite, set the
  `created_at` values directly through the `engine` fixture so the order is fixed.
- [X] T014 [P] [US2] Add tests to `frontend/src/__tests__/App.test.tsx`:
  - After reopening session A and sending a message, `POST /api/chat` is called with
    `session_id` A, and the reply is added after A's history.
  - A moves to the front of `localStorage["convai.sessionIds"]`, and the sidebar refreshes.
  - **Late reply**: send in A with the fetch held unresolved, switch to B, then resolve.
    A's reply isn't shown in B. Reopening A loads it from history.

### Implementation for User Story 2

- [X] T015 [US2] Update `frontend/src/App.tsx`.
  - Sends use the current `activeSessionId` and remember it when the send starts. Keep a
    `useRef` that tracks the current active ID.
  - When a reply arrives, add it to the messages only if the ref still equals the
    remembered ID. Always call `rememberSession` and refresh the sidebar on success.
  - The pending ("…") indicator shows only while the session it belongs to is open.
  - No backend change is needed: ordering comes from `last_active_at` (T009).
  - T013 and T014 must pass.

**Checkpoint**: US1 and US2 both work. Run quickstart.md scenarios 5 and 6.

---

## Phase 5: User Story 3 - Start a new conversation (Priority: P3)

**Goal**: The user can start a fresh conversation from the sidebar. It only appears in the
list once a message has been sent.

**Independent Test**: With a conversation open, choose **New chat** and send a message. A
new entry appears at the top, and the earlier conversation is unchanged (quickstart.md
scenarios 2 and 3).

### Tests for User Story 3 ⚠️

- [X] T016 [P] [US3] Add a test to `frontend/src/__tests__/Sidebar.test.tsx`: a
  **New chat** button is rendered and calls `onNewChat` when clicked.
- [X] T017 [P] [US3] Add tests to `frontend/src/__tests__/App.test.tsx`:
  - With session A open, **New chat** empties the message area.
  - Before any send, no new ID is stored and no new sidebar entry appears.
  - After the first send, the new ID is stored at the front and the sidebar refreshes.
  - A's history is unchanged when reopened.

### Implementation for User Story 3

- [X] T018 [US3] Render a **New chat** button at the top of `frontend/src/Sidebar.tsx`
  that calls `onNewChat`. T016 must pass.
- [X] T019 [US3] Add a `newChat()` handler to `frontend/src/App.tsx`.
  - Set `activeSessionId` to `crypto.randomUUID()`, clear the messages and any sidebar
    error, and clear the input.
  - Don't call `rememberSession` or the server.
  - Pass the handler to `<Sidebar onNewChat>`, and close the narrow-screen sidebar if it's
    open.
  - T017 must pass.

**Checkpoint**: All three stories work on their own.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Update `README.md` (Principle I).
  - In the "API contract (FE ↔ BE)" section, add `GET /api/chat/{session_id}/history`
    (currently undocumented) and `GET /api/sessions?ids=…`, with their response shapes and
    the 400 rule, as in `specs/001-chat-session-sidebar/contracts/sessions-api.md`.
  - In the run and test section, add `cd frontend && npm test`.
- [X] T021 [P] Check that `cd frontend && npm run build` (`tsc -b && vite build`) passes with
  the new files and the vitest config.
- [X] T022 Run the full automated suites: `cd backend && .venv/bin/pytest` and
  `cd frontend && npm test`. Both must pass (Principle IV merge gate).
- [X] T023 Run every manual scenario (1–10) in
  `specs/001-chat-session-sidebar/quickstart.md` against the local Postgres stack, plus its
  `curl` checks. Note any failures.
  - Status (2026-11-04): the `curl` checks pass against the live Postgres stack. Scenarios
    1–10 pass in headless Google Chrome (Playwright). Scenario 7 blocked the history request
    in the browser instead of stopping the backend. The first run found two layout bugs,
    which are now fixed: long unbroken words overflowed the chat area, and on narrow
    screens the open sidebar couldn't be closed without choosing a chat (a backdrop now
    closes it).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies. T002 depends on T001.
- **Foundational (Phase 2)**: depends on Setup. It blocks all stories.
- **US1 (Phase 3)**: depends on Foundational.
- **US2 (Phase 4)** and **US3 (Phase 5)**: depend on Foundational and on T012. Both extend
  the `App.tsx` structure from US1, and continuing or starting chats only makes sense
  alongside the sidebar. Each can still be tested on its own once US1 is in place.
- **Polish (Phase 6)**: depends on the stories you want shipped.

### Within Each Story

- Write the tests (T006–T008, T013–T014, T016–T017) and confirm they fail first.
- Backend endpoint T009 is independent of the frontend tasks and can run in parallel with
  T010 and T011.
- `App.tsx` changes (T012 → T015 → T019) run one after another because they share a file.

### Parallel Opportunities

- Phase 2: T003, T004 and T005 can run in parallel. T004 depends on T003 being written but
  not passing.
- US1: T006, T007 and T008 together. Then T009, T010 and T011 together, followed by T012.
- US2: T013 and T014 together.
- US3: T016 and T017 together. T018 (Sidebar) and T019 (App) touch different files, but
  T019's test also needs T018.
- Polish: T020 and T021 together.

---

## Parallel Example: User Story 1

```bash
# Tests first, all different files:
Task: "Backend tests for GET /api/sessions in backend/tests/test_sessions.py"
Task: "Sidebar component tests in frontend/src/__tests__/Sidebar.test.tsx"
Task: "App reopen-flow tests in frontend/src/__tests__/App.test.tsx"

# Then implementation in parallel:
Task: "Implement GET /api/sessions in backend/app/main.py"
Task: "Create Sidebar component in frontend/src/Sidebar.tsx"
Task: "Create layout styles in frontend/src/styles.css"
# …then App.tsx wiring (T012)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup), then Phase 2 (Foundational).
2. Phase 3 (US1): the sidebar lists and reopens past conversations.
3. **Stop and validate**: run both test suites and quickstart scenarios 1, 4, 7–10. Demo.

### Incremental Delivery

1. Setup and Foundational, then US1 (MVP, demo).
2. US2: continuing a reopened chat, and late replies kept in the right chat.
3. US3: the **New chat** button.
4. Polish: README contract, build, full test run and quickstart.

---

## Notes

- [P] means different files with no dependency on incomplete tasks.
- No schema changes or Alembic migrations are part of this feature (see data-model.md).
- No new runtime dependencies. Only the dev dependencies in T001.
- Commit after each task or logical group. Stop at any checkpoint to validate.
