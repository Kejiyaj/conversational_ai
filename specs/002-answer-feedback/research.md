# Research: Answer Feedback

Phase 0 output for [plan.md](./plan.md). The Technical Context had no open questions. This
file records the design decisions and why each was made.

## R1. One feedback row per message, enforced by the database (FR-010, FR-012, SC-004)

- **Decision**: a new `feedback` table with a foreign key `message_id → messages.id` and a
  **unique constraint on `message_id`**. A resubmission updates the existing row.
- **Rationale**: "at most one record per message, even for simultaneous submissions" is
  only guaranteed if the database refuses a second row. Application checks alone can race.
  A plain foreign key (no cascade) matches the existing `messages → sessions` link, and
  messages are never deleted.
- **Alternatives considered**:
  - *Append-only rows, with the latest one winning*: keeps a history of changes, but the
    spec says history is out of scope, and every reader would need "latest per message"
    logic.
  - *Columns on `messages`*: no new table and no join, but the request asks for a new table
    linked to the message, and it would put feedback onto every user row too.

## R2. Keeping the rating relaxable for future escalation records (spec Assumptions)

- **Decision**: `rating` is `NOT NULL` now, with a check `rating IN ('up', 'down')`. The
  check passes NULLs by nature, so nothing else has to change when the column is relaxed.
  Relaxing it later is one migration with `ALTER COLUMN rating DROP NOT NULL`. It needs no
  data rewrite and no change to other columns. The API keeps requiring a rating.
- **Rationale**: today every record is a user rating, so the database should say so. The
  other constraints don't depend on the rating being present, except one: the check
  `reason IS NULL OR rating = 'down'` also passes when the rating is NULL.
- **Known follow-up, not built here**: the unique constraint on `message_id` (R1) would also
  stop an escalation record and a thumbs rating from living on the same turn. When
  escalation exists, that constraint is the next thing to revisit, for example by making it
  unique on `(message_id, kind)` with a new `kind` column. Adding `kind` now would be
  speculative (Principle V), so it is left for the escalation spec.
- **Alternatives considered**: a nullable `rating` now (the database would then accept rows
  with no rating, which no code path can produce today), and a `kind` column now
  (speculative).

## R3. Which rules live in the database and which in code (FR-003, FR-004)

- **Decision**: the database enforces only rules that are stable: the rating values and
  "a reason only goes with a down rating". The **provisional reason list** is enforced in
  code only, as one constant (`REASONS`) in `app/feedback.py`. The column is plain `text`
  with no check on its values. The comment limit (1000) is also code only.
- **Rationale**: FR-004 says changing the reason list must not require changing anything
  else. A database check on the values would turn every approved list change into a
  migration. A single constant makes the change one line plus its test.
- **Alternatives considered**: a database check on the four values (rejected, see above),
  a lookup table of reasons (a table and a join for four values, against Principle V), and a
  Postgres enum (changing an enum is more awkward than changing a check).

## R4. Returning 400, not FastAPI's 422, for every invalid input (FR-020, constitution)

- **Decision**: the handler reads the request body itself and validates it with one small
  function, `parse_feedback_body()`. Every invalid-input case raises
  `HTTPException(400, detail=...)`. The `message_id` path value is taken as a string and
  checked by the handler too. The response uses a normal Pydantic response model. The raw
  body is read by a small async dependency (`await request.body()`), so the handler itself
  stays a plain sync `def` like the others and runs in the thread pool.
- **Rationale**: the constitution requires `{"detail": ...}` with status 400. If the request
  fields were declared as Pydantic models, a missing field, a wrong type or a body that
  isn't JSON would return 422 before the handler runs.
- **Alternatives considered**:
  - *An app-wide handler turning 422 into 400*: rejected. It would change the responses of
    existing endpoints (for example, a missing `message` on `POST /api/chat`), which breaks
    FR-017.
  - *A custom route class that maps the validation error only for this route*: works, but
    is more machinery than a 30-line validation function.
  - *All fields optional in Pydantic, with the checks in the handler*: leaves wrong types
    (for example `"rating": 5`) returning 422.
- **Cost**: the endpoint's request schema doesn't appear in the generated OpenAPI page. The
  contract file is the source of truth for it.

## R5. Create-or-replace without a dialect-specific upsert (FR-012, FR-013)

- **Decision**: look up the feedback row by `message_id`. If it exists, assign the new
  values. If not, insert a new row. If the insert hits the unique constraint because
  another request got there first, roll back and repeat once, so the second pass updates
  the row the other request created. This is the same retry pattern as `_persist` in
  `main.py` for new sessions.
- **Rationale**: the tests run on SQLite and production runs on Postgres. A portable
  approach avoids `INSERT … ON CONFLICT` from two different dialect modules and keeps the
  production path the same code the tests run. With simultaneous submissions the last one
  to commit wins, which the spec allows.
- **Alternatives considered**: `INSERT … ON CONFLICT DO UPDATE` through the Postgres
  dialect (atomic, but the SQLite tests would need a second code path), and locking the
  message row with `SELECT … FOR UPDATE` (not supported on SQLite).

## R6. Resubmitting identical feedback changes nothing (FR-013)

- **Decision**: `updated_at` has `onupdate=func.now()`, and the handler simply assigns the
  values. SQLAlchemy sends no `UPDATE` when the assigned values equal the stored ones, so
  `updated_at` is not touched. `created_at` and `updated_at` default to `now()`.
- **Rationale**: "leave the stored feedback unchanged" includes the timestamps. No explicit
  comparison code is needed.
- **Test note**: on SQLite, `now()` has one-second resolution, so a test can assert that an
  identical resubmission leaves `updated_at` equal, but must not assert that a real change
  makes it larger.

## R7. Adding `message_id` to the chat response (FR-016, FR-017)

- **Decision**: `ChatResponse` gains `message_id: int | None`, the id of the assistant row. It is
  always an integer today. It is typed nullable because Principle I requires new fields to be
  nullable or optional, and `null` is reserved for a future flow that creates no assistant
  message. `_persist`
  flushes after adding the two messages, reads the assistant row's id, then commits, and
  returns the id to the handler. The user's message id is not exposed.
- **Rationale**: ids are assigned at flush, so no extra query is needed, and the commit
  stays the single transaction from the persistence spec. The field is purely additive. The
  frontend type in `frontend/src/api.ts` doesn't list it and only reads `reply`, so it
  keeps working unchanged. The mock reply and the agent reply take the same code path.
- **Consequence for existing tests**: two assertions in `backend/tests/test_chat.py` compare
  the whole chat response body, and they now also contain `message_id`. Those two are
  updated. SC-006 in the spec is reworded to say so. No behaviour assertion is weakened.
- **Alternatives considered**: returning the user message id as well (not needed, and it
  invites feedback attempts that are refused), and making clients read the id from the
  history endpoint (works, but costs a second request and is what the new field avoids).

## R8. Status codes and the order of checks (FR-002 to FR-008)

- **Decision**: checks run in this order, and the first failure wins:
  1. `message_id` is a positive whole number of at most 18 digits (400).
  2. The body is a JSON object (400).
  3. `rating`, then `reason`, then `comment` are valid (400).
  4. The message exists (404).
  5. The message is an assistant message (400).
- **Rationale**: the cheap checks that need no database run first, so a malformed request
  gets the same answer whether or not the message exists. A user message returns 400 and
  not 409 or 422, because the constitution says invalid client input is 400. "Not found" is
  kept apart as 404, as the spec asks.
- **Alternatives considered**: looking the message up first (a database round trip for
  requests that are going to fail anyway).

## R9. The trace identifier (FR-011)

- **Decision**: `trace_id` is a nullable `text` column with no foreign key and no index. It
  is not read from the request, and a `trace_id` key in the request body is ignored. It is
  returned in the response and is `null` for now.
- **Rationale**: there is nothing to link to yet, and the identifier's format is not known.
  Plain text avoids guessing. An index can be added with the tracing feature if it is ever
  searched on.
- **Alternatives considered**: refusing a body that contains `trace_id` with a 400 (stricter,
  but it makes the contract surprising for a field clients never need to know about), and
  leaving it out of the response (hides a field that will matter to reviewers).

## R10. Migration, constraint names and verification (FR-021, Principle III)

- **Decision**: migration `0002` creates `feedback`. The naming convention in `app/db.py`
  gains a `uq` entry, `uq_%(table_name)s_%(column_0_name)s`, so the unique constraint is
  named `uq_feedback_message_id`. Check constraints are named explicitly, as
  `ck_messages_role` is. The names are `ck_feedback_rating` and
  `ck_feedback_reason_requires_down`. The tests build tables from the models on SQLite, as
  today. The migration is verified in Docker with `alembic upgrade head`, then
  `alembic check`, and a `downgrade -1` and `upgrade head` round trip. These steps are in
  [quickstart.md](./quickstart.md).
- **Rationale**: this follows the same pattern as the persistence migration. The `uq` entry
  changes no existing name, because there are no unique constraints yet.
- **Alternatives considered**: running the migration against SQLite in the tests (the
  Postgres identity column and the check syntax would need special cases, for little extra
  safety), and adding no convention entry and naming the constraint by hand (works, but
  leaves the convention incomplete for the next unique constraint).

## R11. Where the code lives (Principle V)

- **Decision**: one new module, `backend/app/feedback.py`. It holds the constants, the body
  validation, the create-or-replace helper and an `APIRouter` with the endpoint. `main.py`
  includes the router, and gains only the `message_id` change from R7.
- **Rationale**: `main.py` already holds chat, history and sessions, and the feedback logic
  is the largest single piece in this change. A router is plain FastAPI, adds no
  dependency, and keeps the new rules in one file with their tests.
- **Alternatives considered**: adding everything to `main.py` (about 120 more lines in one
  file, as `001` did for a smaller change).

## R12. Comment handling (FR-005, FR-006)

- **Decision**: a comment must be a string. If it is empty or only whitespace, it is stored
  as `NULL`. Otherwise it is stored exactly as submitted, without trimming. The 1000-character
  limit is measured on the submitted text, counted in characters (Python `len`).
- **Rationale**: it keeps the user's own text intact, and the limit is simple to state and
  test at exactly 1000 and 1001.
- **Alternatives considered**: trimming before storing and counting (changes what the user
  wrote), and a database length check (makes a policy value a migration, see R3).
