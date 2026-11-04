---

description: "Task list for the Answer Feedback feature"
---

# Tasks: Answer Feedback

**Input**: Design documents from `specs/002-answer-feedback/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/feedback-api.md, quickstart.md

**Tests**: Included. Constitution Principle IV requires at least one automated test for each
behaviour and error case in the spec, and `CLAUDE.md` says to write tests before code. Backend
tests use pytest with in-memory SQLite (`backend/tests/conftest.py` already provides the
`client` and `engine` fixtures, and SQLite enforces foreign keys there). Write each test task
before its implementation task and confirm it fails first. The contract's test obligations
(`contracts/feedback-api.md`, points 1 to 14) are spread across the stories below.

**Organization**: Tasks are grouped by user story. All new tests go in one file,
`backend/tests/test_feedback.py`, and all new endpoint code goes in one module,
`backend/app/feedback.py` (plan.md, Structure Decision), so most tasks run in order and few
are marked [P].

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1 to US5)

## Path Conventions

This is the existing backend: code in `backend/app/`, migrations in `backend/alembic/versions/`,
tests in `backend/tests/`. The frontend is not changed. Run commands from `backend/` with the
Python 3.12 venv from the README.

---

## Phase 1: Setup

**Purpose**: Know the starting point. There are no new dependencies and no new tooling.

- [X] T001 Confirm a clean baseline. In `backend/`, with the venv from `requirements-dev.txt`,
  run `pytest` and check that every existing test passes. Write down the number of tests, to
  compare with T027.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The `feedback` table, its model, its migration and the empty router. Every story
needs these.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T002 Create `backend/tests/test_feedback.py` with shared helpers and the table-rule
  tests, and confirm they fail (the model doesn't exist yet). The helpers: `send_chat(client,
  session_id="s1", message="hello")` returns the `message_id` from the chat response, and
  `user_message_id(client, session_id)` reads the user message's id from
  `GET /api/chat/{session_id}/history`. Use `engine` and `Session(engine)` to check the table
  directly. Table-rule tests (data-model.md):
  - A second `Feedback` row for the same `message_id` raises `IntegrityError` (`uq_feedback_message_id`).
  - `rating` accepts `'up'` and `'down'` and rejects `'Up'` and `'maybe'` (`ck_feedback_rating`).
  - `reason` with `rating = 'up'` is rejected, and with `'down'` is accepted. A `NULL` reason
    is accepted with either rating (`ck_feedback_reason_requires_down`: `reason IS NULL OR rating = 'down'`).
  - `trace_id` is `NULL` when not given, and `created_at` and `updated_at` are filled in.
  - A `message_id` that doesn't exist in `messages` is rejected (`fk_feedback_message_id`).
- [X] T003 [P] In `backend/app/db.py`, add `"uq": "uq_%(table_name)s_%(column_0_name)s"` to the
  `naming_convention` of `Base.metadata`. Keep the `ix`, `pk` and `fk` entries as they are.
- [X] T004 Add the `Feedback` model to `backend/app/models.py`, table `feedback`, exactly as in
  data-model.md:
  - `id` bigint identity primary key, with the `Integer` SQLite variant as on `Message.id`.
  - `message_id` bigint, `NOT NULL`, foreign key to `messages.id` (no cascade), `unique=True`.
  - `rating` text, `NOT NULL`.
  - `reason` text, nullable.
  - `comment` text, nullable.
  - `trace_id` text, nullable, no foreign key and no index.
  - `created_at` timestamptz, `NOT NULL`, `server_default=func.now()`.
  - `updated_at` timestamptz, `NOT NULL`, `server_default=func.now()` and `onupdate=func.now()`.
  - Table args: `CheckConstraint("rating IN ('up', 'down')", name="ck_feedback_rating")` and
    `CheckConstraint("reason IS NULL OR rating = 'down'", name="ck_feedback_reason_requires_down")`.
  - No check on the values of `reason`, and no length check on `comment` (research R3).
  Run the T002 tests and check that they pass. (Depends on T002 and T003.)
- [X] T005 Create `backend/alembic/versions/0002_create_feedback.py` (`revision = "0002"`,
  `down_revision = "0001"`). `upgrade()` creates `feedback` with the same columns and the
  constraint names `pk_feedback`, `fk_feedback_message_id`, `uq_feedback_message_id`,
  `ck_feedback_rating` and `ck_feedback_reason_requires_down`. `downgrade()` drops the table.
  Follow the style of `0001_create_sessions_and_messages.py`. (Depends on T004.)
- [X] T006 Create `backend/app/feedback.py` with no routes yet:
  - `REASONS = ("incorrect", "unclear", "wanted_a_person", "other")`. This is the provisional
    list (FR-004), and it lives only here.
  - `MAX_COMMENT_CHARS = 1000`.
  - `FeedbackResponse`, a Pydantic model with `from_attributes=True` and the fields
    `message_id: int`, `rating: str`, `reason: str | None`, `comment: str | None`,
    `trace_id: str | None`, `created_at: datetime`, `updated_at: datetime`.
  - `router = APIRouter()`.
  In `backend/app/main.py`, add `app.include_router(feedback.router)`. Check that the app still
  imports and the existing tests still pass. (Depends on T004.)
- [X] T007 Verify the migration in Docker (quickstart.md, step 2). Run
  `docker compose up --build -d`. Check that the backend logs show `0001 -> 0002`, that
  `docker compose exec backend alembic check` prints "No new upgrade operations detected.",
  and that `docker compose exec db psql -U app -d convai -c '\d feedback'` shows the columns,
  the unique constraint, both check constraints and the foreign key. Then run
  `alembic downgrade -1` followed by `alembic upgrade head`. Then repeat the migration check
  on **Postgres 14**, which the constitution requires alongside 17:
  - If a local Postgres 14 exists (for example the Homebrew one, check with `psql --version`
    or `brew list | grep postgresql@14`), create an empty `convai` database in it and use its
    URL below.
  - Otherwise start a temporary container and wait until it is ready:
    `docker run -d --rm --name convai-pg14 -e POSTGRES_USER=app -e POSTGRES_PASSWORD=app -e POSTGRES_DB=convai -p 5434:5432 postgres:14`,
    then `until docker exec convai-pg14 pg_isready -U app -d convai; do sleep 1; done`. Its URL
    is `postgresql://app:app@localhost:5434/convai`.
  - From `backend/`, with that URL in `DATABASE_URL`, run `alembic upgrade head` and then
    `alembic check`. Expect "No new upgrade operations detected."
  - Stop the temporary container with `docker rm -f convai-pg14`, if you started one.
  (Depends on T005.)

**Checkpoint**: the table-rule tests pass, and the migration is applied and checked in Docker
(Postgres 17) and on Postgres 14.

---

## Phase 3: User Story 1 - Rate an answer (Priority: P1) 🎯 MVP

**Goal**: A chat reply identifies the assistant message it contains, and a valid "up" or
"down" rating for that message is stored and confirmed.

**Independent Test**: send a chat message, take `message_id` from the reply, and POST
`{"rating": "up"}` to `/api/messages/{message_id}/feedback`. The response is 200, and one row
exists for that message.

> This phase accepts whatever it is given. Input checks come in User Story 2, so do not
> release this story without it.

### Tests for User Story 1 (write first, confirm they fail)

- [X] T008 [US1] In `backend/tests/test_chat.py`, update the two assertions that compare the
  whole chat response (`test_mock_fallback_when_agent_url_empty` and
  `test_agent_reply_is_stored_with_source_agent`). Keep their `session_id`, `reply` and
  `intent` checks, and check that `message_id` is also present. These are the only edits to
  existing tests (SC-006).
- [X] T009 [US1] In `backend/tests/test_chat.py`, add tests for contract point 1:
  - The response has exactly the keys `session_id`, `reply`, `intent` and `message_id`.
  - `message_id` is an integer and is never `null` today (the contract types it `integer | null`).
  - `message_id` equals the id of the stored **assistant** message, for a mock reply and, with
    `main.call_agent` patched as in the existing tests, for an agent reply.
  - It is not the id of the user's message.
  - Two turns in one session return different `message_id`s.
  (Depends on T008.)
- [X] T010 [US1] In `backend/tests/test_feedback.py`, add happy-path tests (contract points
  2 and 3, FR-009, FR-010, FR-015):
  - Rating `up` and rating `down` each return 200 with `message_id`, `rating`, `reason: null`,
    `comment: null`, `trace_id: null`, `created_at` and `updated_at`, and store exactly one row
    linked to that message.
  - Feedback on a mock reply (`source = 'mock'`) is accepted, and the same message can be
    joined to its feedback row.
  - Feedback on an agent reply (`source = 'agent'`) is accepted too. Patch `main.call_agent` as
    the tests in `test_chat.py` do, and set `AGENT_URL`.
  - `GET /api/chat/{session_id}/history` is unchanged and contains no feedback.
  (Depends on T006.)

### Implementation for User Story 1

- [X] T011 [US1] In `backend/app/main.py`, add `message_id: int | None` to `ChatResponse`, as
  the contract types it (Principle I: new fields are nullable or optional). It is always set to
  the assistant message's id, and `null` is reserved for a future flow with no assistant
  message. Do not give it a default, so a missing id would show up as a validation error
  instead of a silent `null`. Change
  `_persist` so that after adding the two messages it calls `db.flush()`, reads the assistant
  message's `id`, then commits and returns the id. The `chat` handler passes it into
  `ChatResponse`. Both messages stay in one transaction, and the user message id is not
  exposed. Run T008 and T009 and check that they pass. (Depends on T009.)
- [X] T012 [US1] In `backend/app/feedback.py`, add the route `POST /api/messages/{message_id}/feedback`
  as a plain sync `def`, with `response_model=FeedbackResponse`. For now: take `message_id` as
  a string and convert it to an integer, read `rating` from the JSON body, load the
  `Message` with `db.get`, insert a `Feedback(message_id=…, rating=…)` and commit, and return
  it. Run T010 and check that it passes. (Depends on T010 and T011.)

**Checkpoint**: chat replies carry `message_id`, and a valid rating is stored and confirmed.

---

## Phase 4: User Story 2 - Reject feedback that doesn't make sense (Priority: P1)

**Goal**: Only valid feedback on assistant messages is accepted. Everything else is refused
with a clear message, and nothing is stored.

**Independent Test**: submit feedback for a user message, an unknown id, a non-numeric id, a
bad rating and a bad body. Each returns the status and `detail` from the contract, and the
`feedback` table stays empty.

### Tests for User Story 2 (write first, confirm they fail)

- [X] T013 [US2] In `backend/tests/test_feedback.py`, add refusal tests (contract points 4, 5,
  6, 9 and 13). Each one also checks that the `feedback` table is empty afterwards and that
  the message count is unchanged (FR-012, FR-014). Use these exact responses:
  - `message_id` of `abc`, `1.5`, `-1`, `0`, `007` or a 19-digit number returns 400
    `{"detail": "message_id must be a positive whole number of at most 18 digits"}`.
  - A body that is not JSON, a JSON array, a string or `null` returns 400
    `{"detail": "request body must be a JSON object"}`.
  - `rating` missing, `null`, `""`, `"Up"`, `"thumbs_up"`, `true` or `5` returns 400
    `{"detail": "rating must be \"up\" or \"down\""}`.
  - `reason` given with `rating` `up` returns 400
    `{"detail": "reason is only allowed with a \"down\" rating"}`.
  - An id that exists nowhere (for example `999`) returns 404 `{"detail": "message not found"}`.
  - The id of a user message returns 400
    `{"detail": "feedback is only allowed on assistant messages"}`.
  - Order of checks: an invalid body sent to an id that doesn't exist returns 400, not 404.
  - A `trace_id` key in the body is ignored: the request succeeds and the stored and returned
    `trace_id` is `null`.
  (Depends on T012.)

### Implementation for User Story 2

- [X] T014 [US2] In `backend/app/feedback.py`, add the validation from
  contracts/feedback-api.md, in this order, first failure wins:
  - A small async dependency, `raw_body`, that returns `await request.body()`, so the handler
    stays a sync `def`.
  - A path check that `message_id` matches `^[1-9][0-9]{0,17}$` (a positive whole number of
    at most 18 digits). Otherwise raise 400
    `message_id must be a positive whole number of at most 18 digits`.
  - `parse_feedback_body(raw: bytes)`, which uses `json.loads` and requires a JSON object.
    `rating` must be a `str` equal to `"up"` or `"down"`. If `reason` is present and not
    `None`, and the rating is `"up"`, it is refused.
  - Every failure raises `HTTPException(400, detail=<message from the contract>)`.
  - After validation, load the message. If it is missing, raise 404 `message not found`. If its
    `role` is not `'assistant'`, raise 400 `feedback is only allowed on assistant messages`.
  - Keep `trace_id` out of everything read from the body.
  Replace the unvalidated handler from T012. Run T013 and check that it passes. (Depends on T013.)

**Checkpoint**: User Stories 1 and 2 pass. This is the smallest version that is safe to demo.

---

## Phase 5: User Story 3 - Say why an answer was not helpful (Priority: P2)

**Goal**: On a "down" rating, the client can pick one reason from the provisional list, and it
is stored with the rating.

**Independent Test**: POST `{"rating": "down", "reason": "unclear"}` for one assistant message
and `{"rating": "down"}` for another. Both return 200, and the reason is stored only for the
first.

### Tests for User Story 3 (write first, confirm they fail)

- [X] T015 [US3] In `backend/tests/test_feedback.py`, add reason tests (contract point 7,
  FR-003, FR-004):
  - Parametrize over `feedback.REASONS`, so the test follows the list. With `rating` `down`,
    each value returns 200 and is stored and returned as `reason`.
  - `reason` missing or `null` with `down` returns 200 and `reason` is `null`.
  - `"wrong"`, `""`, `"Incorrect"` and `5` with `down` return 400
    `{"detail": "reason must be one of: incorrect, unclear, wanted_a_person, other"}`.
  - The value check comes before the "reason with `up`" check: `{"rating": "up", "reason": "wrong"}`
    returns the "must be one of" message.
  - `wanted_a_person` stores only the reason: no other rows are created or changed (FR-019).
  (Depends on T014.)

### Implementation for User Story 3

- [X] T016 [US3] In `backend/app/feedback.py`, validate `reason` when it is present and not
  `None`: it must be a `str` in `REASONS`, otherwise 400 with the message built from `REASONS`
  (`"reason must be one of: " + ", ".join(REASONS)`). Run this check before the "reason with
  `up`" check from T014. Store `reason` on the row and return it. Run T015 and check that it
  passes. (Depends on T015.)

**Checkpoint**: Stories 1, 2 and 3 pass independently.

---

## Phase 6: User Story 4 - Explain a rating with a comment (Priority: P2)

**Goal**: With either rating, the client can add a comment of at most 1000 characters, and it
is stored with the rating.

**Independent Test**: POST a rating with a comment for one assistant message and a rating
with no comment for another. Both return 200, and the comment is stored only for the first.

### Tests for User Story 4 (write first, confirm they fail)

- [X] T017 [US4] In `backend/tests/test_feedback.py`, add comment tests (contract point 8,
  FR-005, FR-006):
  - A comment is accepted with `up` and with `down`, and is stored and returned unchanged.
  - A comment with leading and trailing spaces is stored exactly as submitted.
  - `""`, `"   "` and `null`, and a missing comment, are stored as `null`.
  - A comment of exactly 1000 characters returns 200, and 1001 characters returns 400
    `{"detail": "comment must be at most 1000 characters"}`.
  - A non-string comment (`5`, `["x"]`) returns 400 `{"detail": "comment must be a string"}`.
  - A refused comment leaves no row.
  (Depends on T016.)

### Implementation for User Story 4

- [X] T018 [US4] In `backend/app/feedback.py`, validate `comment` after `reason`: absent or
  `None` means no comment. If it is not a `str`, return 400 `comment must be a string`. If it
  is empty or only whitespace (`not comment.strip()`), store `None`. Otherwise, if
  `len(comment) > MAX_COMMENT_CHARS`, return 400 `comment must be at most 1000 characters`
  (use `MAX_COMMENT_CHARS`). Store the text exactly as submitted. Run T017 and check that it
  passes. (Depends on T017.)

**Checkpoint**: Stories 1 to 4 pass independently.

---

## Phase 7: User Story 5 - Change a previous rating (Priority: P3)

**Goal**: Submitting feedback again for the same message replaces the earlier feedback. The
message always has exactly one feedback row, even under simultaneous submissions.

**Independent Test**: rate a message `down` with a reason and comment, then `up`. One row
remains, with rating `up` and no reason and no comment.

> Until this story is done, a second submission for the same message fails on the unique
> constraint with a server error. Release this story together with the earlier ones.

### Tests for User Story 5 (write first, confirm they fail)

- [X] T019 [US5] In `backend/tests/test_feedback.py`, add replacement tests (contract points
  10, 11 and 12, FR-012, FR-013, SC-004):
  - A second submission with different values returns 200 and leaves one row with the new
    values.
  - Omitting `reason` and `comment` in the second submission clears the earlier ones.
  - `down` with a reason and comment followed by `up` leaves one row with `up` and no reason
    and no comment.
  - Submitting identical values twice returns 200 both times, and the row, including
    `updated_at`, is unchanged. Do not assert that `updated_at` grows on a real change, because
    SQLite's `now()` has one-second resolution (research R6).
  - After 5 submissions for one message there is exactly one row, holding the last values.
  - Race: patch the lookup helper (name it `find_feedback`) so that its first call returns
    `None` while a row already exists. The insert then hits `uq_feedback_message_id`. The
    request still returns 200 with the latest values, and there is one row.
  (Depends on T018.)

### Implementation for User Story 5

- [X] T020 [US5] In `backend/app/feedback.py`, add `find_feedback(db, message_id)` and
  `save_feedback(db, message_id, data)`. `save_feedback` looks up the existing row. If there
  is one, it assigns `rating`, `reason` and `comment` (assigning every field, so an omitted
  `reason` or `comment` becomes `None`, and assigning equal values makes no `UPDATE`, so
  `updated_at` is untouched). If there is none, it inserts a new row. Then it commits. On
  `IntegrityError` it rolls back and repeats once, and on the second failure it re-raises (the
  same pattern as `_persist` in `main.py`). Use it from the handler in place of the plain
  insert. Run T019 and check that it passes. (Depends on T019.)

**Checkpoint**: all five stories pass independently.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, the full-suite check, end-to-end validation and review.

- [X] T021 [P] Update the API contract section of `README.md` in the same change (FR-022,
  Principle I): show `message_id` (integer or null, always an integer today) in the
  `POST /api/chat` response, and document
  `POST /api/messages/{message_id}/feedback` with its request, its 200 response and the 400
  and 404 cases. State that `trace_id` is always `null` for now and that the reason list is
  provisional. Keep the existing wording of the other endpoints.
- [X] T022 Run the full backend suite with `pytest`. Check that every test from T001 still
  passes, that the only edits to existing tests are the two assertions from T008, and that all
  new tests pass (SC-006).
- [X] T023 [P] Run `cd frontend && npm test` and check that it passes without any frontend
  change (SC-006: existing clients are unaffected).
- [X] T024 Run the end-to-end check in `quickstart.md` (steps 2 and 3, and the manual
  scenarios in step 4) against Docker. Start with `docker compose down -v` for a clean
  database. Check each expected status and body, the single stored row, that `updated_at`
  is the same before and after the identical resubmission, and `alembic check`. Then run
  `docker compose restart backend` and check that the feedback row is still there
  (SC-002, stored after a restart). (Depends on T022.)
- [X] T025 Check the implementation against the spec, as `CLAUDE.md` asks when the Superpowers
  skills are not available. Run `/speckit-analyze`, then `/speckit-converge`, and fix or
  record every finding. (Depends on T024.)
- [X] T026 Open the pull request. Request review from Vinod, because the chat response gains
  a field (Principle I: both sides of a contract change review), and from the backend owner.
  Mention in the description that the reason list is pending approval and that the thumbs UI
  is a separate frontend spec. (Depends on T025.) — Note: merged to main (no PR opened).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. It blocks all user stories.
- **User Stories (Phases 3 to 7)**: all depend on Foundational. They share one test file and one
  endpoint module, so do them in priority order: US1, US2, US3, US4, US5. Each builds on the
  validation code of the one before it.
- **Polish (Phase 8)**: depends on the stories you are shipping. T021 and T023 can start as
  soon as the implementation is done.

### User Story Dependencies

- **US1 (P1)**: starts after Foundational. It also changes the chat response, which no other story depends on.
- **US2 (P1)**: builds on the US1 endpoint, and replaces its unvalidated body handling.
- **US3 (P2)**: builds on the US2 validation, and adds the reason check before the "reason with `up`" check.
- **US4 (P2)**: builds on the US2 validation. It does not depend on US3 in behaviour, but the code goes after the reason check.
- **US5 (P3)**: builds on the US1 insert, and replaces it with create-or-replace.

### Within Each User Story

- Tests are written first and must fail before the implementation.
- Models and migration (Phase 2) come before the endpoint code.
- The story is complete when its tests pass, before moving to the next priority.

### Parallel Opportunities

- T002 and T003 touch different files and can run together.
- T021 (README) and T023 (frontend tests) are independent of each other and of the backend code once it is done.
- Beyond that, the single test file and single module mean sequential work is the safer choice.

---

## Parallel Example: Foundational

```bash
# Different files, no dependency between them:
Task: "Write the table-rule tests in backend/tests/test_feedback.py"          # T002
Task: "Add the uq naming convention in backend/app/db.py"                      # T003
```

---

## Implementation Strategy

### MVP First (User Stories 1 and 2)

1. Complete Phase 1: Setup.
2. Complete Phase 2: Foundational. Stop and check that the migration works in Docker (T007).
3. Complete Phase 3: User Story 1.
4. Complete Phase 4: User Story 2. **Stop and validate**: ratings are stored, bad input is
   refused, and nothing leaks into the table. This is the smallest demo that is safe.
5. Do not release at this point. A second rating for the same message still fails, so continue
   to User Story 5 before any real use.

### Incremental Delivery

1. Setup and Foundational, then US1 and US2: a safe demo.
2. Add US3 (reasons): "down" ratings become actionable. Test independently.
3. Add US4 (comments). Test independently.
4. Add US5 (replace): the full behaviour in the spec. Release from here.
5. Polish: README, full suite, Docker end-to-end, `/speckit-analyze`, `/speckit-converge`, PR.

### Parallel Team Strategy

The work is small and concentrated in two files, so one developer should do it in order.
Vinod's frontend work (thumbs UI, reason picker, comment box, and the `message_id` field on
the `ChatResponse` type in `frontend/src/api.ts`) is a separate spec and can start from
`contracts/feedback-api.md` as soon as it is approved.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks.
- [Story] labels map each task to a user story for traceability.
- Verify that each test fails before writing the code that makes it pass.
- Commit after each task or logical group.
- The reason list (`REASONS`) is provisional. When it is approved or changed, edit that one
  constant and the parametrized test follows it (FR-004).
- Deferred, not tasks here: the thumbs UI (frontend spec), reading and reporting on feedback,
  recording escalation reasons as feedback, rating individual recommendation cards, and filling
  in `trace_id`.

## Phase 9: Convergence

Added by `/speckit-converge` (T025). Out of scope here and tracked elsewhere: `POST /api/chat`
also returns 500 for a message containing a null character. That comes from the earlier
persistence feature, and will be fixed on a separate branch after this one merges.

- [X] T027 Fix the 500s on input the database can't store, per Technology constraint "invalid
  client input returns 400" (FR-006, FR-020, SC-003) (contradicts, HIGH). Tests first, in
  `backend/tests/test_feedback.py`: a comment with a null character (`"a\u0000b"`, `"\u0000"`)
  or an unpaired surrogate (`"a\ud800b"`, `"\udc00"`, `"\ud83d"`) returns 400
  `comment must not contain null or unpaired surrogate characters`, a valid emoji pair is
  accepted, the check runs after the string check and before the length check, and a body
  nested 200,000 deep returns 400 `request body must be a JSON object`. Then, in
  `backend/app/feedback.py`, add `is_storable` and use it in `parse_feedback_body`, and catch
  `RecursionError` next to `ValueError`. Update the contract (new case 7, test point 15), the
  spec (FR-006 and edge cases), the data model, and quickstart step 3.
  **The null-character and surrogate cases can only be proven on Postgres.** SQLite accepts a
  null character, so the pytest cases guard the rule but can't reproduce the 500. Check them
  against Docker Postgres with the curl lines in quickstart step 3 (null character, unpaired
  surrogate and deep body each return 400, with no 500 in the logs).
- [X] T028 Loosen the contract wording for the request body, per contracts/feedback-api.md
  "Content-Type: application/json" (partial, MEDIUM): the header is recommended, not required,
  matching the other endpoints. Add a test that a body without a `Content-Type` header is
  accepted. No code change.
- [X] T029 Fix two stale statements (LOW): in `plan.md`, the project-structure line that said
  `tasks.md` was "not created yet", and in `spec.md`, the Status that said "Draft".
