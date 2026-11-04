# Implementation Plan: Chat Session Sidebar

**Branch**: `spekit-integration` (the feature folder is `001-chat-session-sidebar`) | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-chat-session-sidebar/spec.md`

## Summary

Add a sidebar that lists the conversations started in the current browser, newest first.
Selecting one reopens it, sending a message continues it, and **New chat** starts a fresh
one.

- **Frontend:** remembers this browser's session IDs in `localStorage`. It reopens
  conversations with the existing history endpoint and continues them with the existing
  chat endpoint.
- **Backend:** gains one read-only endpoint, `GET /api/sessions?ids=…`, that returns a
  label and last-active time for each requested session. Both are worked out from the
  existing `messages` table.

There are no schema changes and no changes to existing contracts.

## Technical Context

**Language/Version**: Python 3.12 (backend), TypeScript with React 19 and Vite 8 (frontend)

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x (sync), psycopg 3 (existing). Frontend dev
only: vitest, jsdom and @testing-library/react (new, see R6)

**Storage**: PostgreSQL. Only the existing `sessions` and `messages` tables are read. The
browser's `localStorage` holds the list of session IDs.

**Testing**: pytest with in-memory SQLite (backend). vitest with jsdom and a mocked `fetch`
(frontend).

**Target Platform**: Desktop browsers (main target) and a narrow-screen fallback. Linux or
macOS for the backend.

**Project Type**: Web application (React frontend with a FastAPI backend)

**Performance Goals**: The sidebar is ready within 2 seconds with 100 sessions, and a
conversation opens within 1 second (SC-003).

**Constraints**: Up to 200 session IDs per list request. No new runtime dependencies. Must
work on Postgres 14 and 17 and on SQLite (tests).

**Scale/Scope**: POC. Up to 200 conversations per browser, with one new endpoint and about
4 frontend modules.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the design complies |
|-----------|--------|-------------------------|
| I. Contract-First Interfaces | ✅ Pass | The new `GET /api/sessions` is defined in [contracts/sessions-api.md](./contracts/sessions-api.md) before any code. It's additive, and existing endpoints are unchanged. The README contract section gets the new endpoint and the existing history endpoint, which the README is currently missing, in the same PR. Frontend and backend owners both review. |
| II. Graceful Agent Degradation | ✅ Pass | The agent path isn't touched. Reopened history shows mock replies like any others (FR-012). |
| III. Persistence Through Alembic Only | ✅ Pass | No schema change and no migration. The new endpoint is read-only and creates no rows, and a test checks this. Chat writes stay in the existing single transaction. |
| IV. Tests Run Without External Services | ✅ Pass (with a justified addition) | The backend tests use in-memory SQLite and cover every point in the contract's test list. Frontend behaviour is covered by vitest with jsdom and a mocked `fetch`, with no servers or browser install. The new dev dependencies are listed in Complexity Tracking. |
| V. POC Simplicity | ✅ Pass | No new runtime dependencies, tables, services or abstraction layers. Labels and times are worked out per request (R3). Scoping is a list of IDs in `localStorage`, not a new client-identity concept (R1). |

**Gate result (before research)**: PASS. **After Phase 1 design**: PASS, no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/001-chat-session-sidebar/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── sessions-api.md  # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created yet)
```

### Source Code (repository root)

```text
backend/
├── app/
│   └── main.py              # + SessionSummary/SessionsResponse models, GET /api/sessions
└── tests/
    └── test_sessions.py     # new: contract test points 1–7

frontend/
├── package.json             # + "test" script; dev deps vitest, jsdom, @testing-library/react
├── vite.config.ts           # + vitest config (environment: jsdom)
└── src/
    ├── main.tsx             # imports styles.css
    ├── App.tsx              # sidebar layout, active session, reopen/continue/new chat, late replies
    ├── api.ts               # new: listSessions(), getHistory(), sendMessage()
    ├── sessionStore.ts      # new: localStorage list of session IDs (try/catch, cap 200, memory fallback)
    ├── Sidebar.tsx          # new: list, empty state, active highlight, New chat, error + Retry
    ├── styles.css           # new: two-column layout, ellipsis, narrow-screen collapse
    └── __tests__/
        ├── sessionStore.test.ts
        ├── Sidebar.test.tsx
        └── App.test.tsx

README.md                    # contract section: + GET /api/sessions, + history endpoint; frontend test command
```

**Structure Decision**: this is the existing web-application layout, with `backend/app` and
`frontend/src`. The backend keeps its single module, with the new handler next to the
existing ones in `main.py`. The frontend splits only by need: API calls, storage and the
sidebar component. There's no router or state-management library.

## Complexity Tracking

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Frontend dev deps: `vitest`, `jsdom`, `@testing-library/react` | Principle IV needs automated tests for each behaviour in the spec, and most of this feature runs in the browser. These are dev-only and add nothing to the runtime bundle. | Manual checks alone would break Principle IV. Playwright needs a browser install and running servers, so it's heavier and against "no external services". |
