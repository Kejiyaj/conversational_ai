# Implementation Plan: Answer Feedback

**Branch**: `002-answer-feedback` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-answer-feedback/spec.md`

## Summary

Let a client rate an assistant answer "up" or "down", with an optional reason (on "down" only)
and an optional comment, and store it against that answer.

- **New endpoint:** `POST /api/messages/{message_id}/feedback`. It validates the input,
  checks that the message exists and is an assistant message, and creates or replaces one
  feedback row for it. Every invalid input returns 400 with `{"detail": ...}`.
- **New table:** `feedback`, added by migration `0002`. One row per message (a unique
  constraint), a nullable `trace_id` for future tracing, and `rating` kept easy to relax for
  future escalation records.
- **Additive change to the chat reply:** `POST /api/chat` also returns `message_id`, the id of
  the assistant message, so the client knows what to rate. Existing fields are unchanged.

No frontend changes, no new dependencies, and no changes to the history, sessions or health
endpoints.

## Technical Context

**Language/Version**: Python 3.12 (backend). No frontend change.

**Primary Dependencies**: FastAPI, SQLAlchemy 2.x (sync), psycopg 3, Alembic. All exist
already, and nothing new is added.

**Storage**: PostgreSQL. A new `feedback` table. `sessions` and `messages` are unchanged.

**Testing**: pytest with in-memory SQLite, as for the other backend tests.

**Target Platform**: Linux or macOS for the backend, in Docker.

**Project Type**: Web service (the backend of the existing web application)

**Performance Goals**: A submission is confirmed within 1 second (SC-005). It takes one
lookup of the message, one lookup of the feedback row by its unique key, and one write.

**Constraints**: Every invalid input returns 400 (not 422). The migration must work on
Postgres 14 and 17. The tests must work on SQLite. The existing chat contract keeps all its
fields.

**Scale/Scope**: POC. One new endpoint, one new table, one new module and one changed
response.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the design complies |
|-----------|--------|-------------------------|
| I. Contract-First Interfaces | ✅ Pass | The new endpoint and the new `message_id` field are defined in [contracts/feedback-api.md](./contracts/feedback-api.md) before any code. Both are additive: `session_id`, `reply` and `intent` keep their names, types and meaning. The affected consumers are named in the contract (frontend: optional use, backend: both changes, agent: none). The README contract section gets both changes in the same PR, and the frontend and backend owners both review. |
| II. Graceful Agent Degradation | ✅ Pass | The agent path isn't touched. `message_id` is returned for mock and agent replies alike, and feedback is accepted on both (FR-009). The existing `source` column keeps the two kinds of answer apart. |
| III. Persistence Through Alembic Only | ✅ Pass | The table comes from migration `0002` only. Constraint names follow the convention in `app/db.py`, which gains a `uq` entry for the one new unique constraint (research R10). The feedback write is one transaction, and a refused submission writes nothing. The chat change reads the id inside the existing single transaction. The new endpoint is the only writer, and no read endpoint creates rows. |
| IV. Tests Run Without External Services | ✅ Pass | The tests use in-memory SQLite and cover every point in the contract's test list, including each refusal and the race. The migration is checked in Docker as in the persistence feature (quickstart step 2). Two assertions in the existing chat tests are updated for the new field (R7, SC-006). |
| V. POC Simplicity | ✅ Pass | No new runtime dependency, service or abstraction layer. One table, one module with a plain `APIRouter`, and validation in one small function. The reason list is a constant. Nothing speculative is built for escalation: only the rating is kept easy to relax (R2), and the follow-up is written down. |

Also checked against the technology constraints: sync SQLAlchemy and `psycopg` (yes),
Postgres 14 and 17 (plain DDL: identity column, foreign key, checks), the 400 `{"detail"}`
error shape (R4), and no new environment variables, so `.env.example` is unchanged.

**Gate result (before research)**: PASS. **After Phase 1 design**: PASS, no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/002-answer-feedback/
├── spec.md
├── plan.md              # this file
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── feedback-api.md  # Phase 1
├── checklists/
│   └── requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks; not created yet)
```

### Source Code (repository root)

```text
backend/
├── alembic/versions/
│   └── 0002_create_feedback.py   # new: feedback table, constraints
├── app/
│   ├── db.py                     # + "uq" entry in the naming convention
│   ├── models.py                 # + Feedback model
│   ├── feedback.py               # new: REASONS, MAX_COMMENT_CHARS, parse_feedback_body(),
│   │                             #      create-or-replace helper, APIRouter, response model
│   └── main.py                   # ChatResponse + message_id; _persist returns the assistant id;
│                                 #      app.include_router(feedback.router)
└── tests/
    ├── test_chat.py              # two whole-body assertions gain message_id; + message_id tests
    └── test_feedback.py          # new: contract test points 2–13

README.md                         # contract section: message_id on the chat response, new
                                  # feedback endpoint
```

**Structure Decision**: this is the existing backend layout, with one new module for the
feedback rules. `main.py` keeps the chat, history and sessions handlers and gains only the
`message_id` change and the `include_router` line. The frontend is not touched, because the
new field is ignored by its current types. Adding `message_id` to its `ChatResponse` type
belongs in the frontend spec for the thumbs UI, owned by Vinod.

## Complexity Tracking

No violations to justify. The additions that could look like extra layers are a single
`APIRouter` module and one entry in the naming convention. Both are covered in
[research.md](./research.md) (R10, R11).
