# Data Model: Answer Feedback

**Schema change: one new table, `feedback`, added by Alembic migration `0002`.** The existing
`sessions` and `messages` tables are not changed.

## New table: `feedback`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `id` | bigint identity | no | generated | Primary key, `pk_feedback`. SQLite variant is `Integer`, as for `messages.id`. |
| `message_id` | bigint | no | none | Foreign key to `messages.id`, `fk_feedback_message_id`. **Unique**, `uq_feedback_message_id`. |
| `rating` | text | no | none | `up` or `down`. Check `ck_feedback_rating`. See "Relaxing the rating" below. |
| `reason` | text | yes | none | One of the reason list, or `NULL`. Only with `down`. Values are not checked by the database (research R3). |
| `comment` | text | yes | none | Free text, or `NULL`. At most 1000 characters (checked in code). |
| `trace_id` | text | yes | none | Always `NULL` for now. Filled in by the system once agent tracing exists. No foreign key and no index. |
| `created_at` | timestamptz | no | `now()` | When the feedback was first given. |
| `updated_at` | timestamptz | no | `now()` | Set to `now()` whenever the row is updated. |

Constraints and indexes:

| Name | Rule |
|------|------|
| `pk_feedback` | primary key on `id` |
| `fk_feedback_message_id` | `message_id` references `messages(id)`, no cascade |
| `uq_feedback_message_id` | one feedback row per message. It also serves as the lookup index. |
| `ck_feedback_rating` | `rating IN ('up', 'down')` |
| `ck_feedback_reason_requires_down` | `reason IS NULL OR rating = 'down'` |

The reason list is in code: `REASONS = ("incorrect", "unclear", "wanted_a_person", "other")`
in `backend/app/feedback.py`. It is provisional (FR-004). The comment limit
`MAX_COMMENT_CHARS = 1000` is there too.

## Relationships

```text
sessions 1 ──< messages 1 ──0..1 feedback
                  role = 'assistant' only (enforced in code)
```

- A message has zero or one feedback row (`uq_feedback_message_id`).
- Only assistant messages get a row. This is enforced in the handler, because a check across
  tables isn't possible in a plain check constraint, and no other code path writes feedback.
- Feedback is never created by a read endpoint, and a refused submission creates nothing.

## Validation rules (applied before anything is written)

| Field | Rule | Failure |
|-------|------|---------|
| path `message_id` | a positive whole number of at most 18 digits: `^[1-9][0-9]{0,17}$` | 400 |
| body | a JSON object | 400 |
| `rating` | the string `up` or `down`, exactly | 400 |
| `reason` | absent or `null`: no reason. Otherwise a string in `REASONS`, and the rating must be `down` | 400 |
| `comment` | absent or `null`: no comment. Otherwise a string with no null character and no unpaired surrogate (the database can't store them). Empty or whitespace-only: no comment. At most 1000 characters. | 400 |
| `trace_id` | not read from the request. A `trace_id` key in the body is ignored. | none |
| the message | must exist, and `role = 'assistant'` | 404 / 400 |

The exact messages and the order are in [contracts/feedback-api.md](./contracts/feedback-api.md).

## State of a message's feedback

```text
none ──valid submission──► recorded
recorded ──valid submission, different values──► recorded (values replaced, updated_at set)
recorded ──valid submission, same values──► recorded (nothing changes, updated_at kept)
any ──refused or failed submission──► unchanged
```

A replacement overwrites every field. A field left out of the new submission (`reason`,
`comment`) becomes `NULL`, so a switch from `down` with a reason to `up` leaves no reason
(FR-012).

## Relaxing the rating (planned, not built)

Escalation reasons may later be recorded as feedback with no user rating. `rating` is
`NOT NULL` today, because every row is a user rating. To allow rows without one, a later
migration runs `ALTER COLUMN rating DROP NOT NULL`. Nothing else has to change:

- `ck_feedback_rating` and `ck_feedback_reason_requires_down` both accept a `NULL` rating.
- No other column and no index depends on the rating being present.
- Existing rows are untouched.

The unique constraint on `message_id` would also need a second look at that point (research
R2). It is deliberately left alone now.

## Changes to existing response shapes

| Shape | Change |
|-------|--------|
| `ChatResponse` (`POST /api/chat`) | **Adds** `message_id` (`integer | null`, always an integer today): the id of the assistant message created by this request. `session_id`, `reply` and `intent` are unchanged. |
| `HistoryResponse`, `SessionsResponse`, health | None |

No stored column is added for this. The id is read from the assistant row during the chat
request's existing transaction.
