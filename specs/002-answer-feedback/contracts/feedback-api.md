# Contract: Frontend ↔ Backend for Answer Feedback

This contract **adds** one endpoint and **adds one field** to an existing response. Under
Principle I, both changes are additive: existing fields keep their names, types and meaning.
The frontend and backend owners both review it, and `README.md` is updated in the same PR.

Affected consumers: the **frontend** (it may use the new field and is not required to), and
the **backend**. The **agent** is not involved.

## Changed: `POST /api/chat` response (additive)

The request is unchanged. The response gains `message_id`.

```json
{
  "session_id": "string",
  "reply": "string",
  "intent": "string | null",
  "message_id": 42
}
```

- `message_id` is an integer: the id of the **assistant** message created for this reply. It is
  the id to use in the feedback endpoint.
- It is present on every successful reply, whether the reply came from the agent or from the
  fallback responder.
- The id of the user's message is not exposed.
- `session_id`, `reply` and `intent` are exactly as before.

## New: `POST /api/messages/{message_id}/feedback`

Records the user's rating of one assistant message. Submitting again for the same message
replaces the earlier feedback.

### Request

| Part | Rules |
|------|-------|
| path `message_id` | Decimal digits only, 1 to 18 characters. |
| body | A JSON object (`Content-Type: application/json`). |

```json
{ "rating": "down", "reason": "unclear", "comment": "I didn't understand the second step." }
```

| Field | Required | Rules |
|-------|----------|-------|
| `rating` | yes | Exactly `"up"` or `"down"`. |
| `reason` | no | Only with `"down"`. When present, one of `incorrect`, `unclear`, `wanted_a_person`, `other`. Absent or `null` means no reason. The list is provisional (FR-004). |
| `comment` | no | A string of at most 1000 characters, with either rating. Absent, `null`, empty or whitespace-only means no comment. Stored exactly as submitted otherwise. |

Any other key in the body, including `trace_id`, is ignored.

### Responses

**200**: the feedback is stored (created or replaced). Both cases return 200.

```json
{
  "message_id": 42,
  "rating": "down",
  "reason": "unclear",
  "comment": "I didn't understand the second step.",
  "trace_id": null,
  "created_at": "2026-11-04T09:15:44.871000+00:00",
  "updated_at": "2026-11-04T09:15:44.871000+00:00"
}
```

- `reason` and `comment` are `null` when there is none.
- `trace_id` is always `null` until agent tracing exists.
- `created_at` is when the feedback was first given. `updated_at` is when it was last changed.
  Submitting the same values again returns 200 and changes neither.

**400**: invalid input. Nothing is stored. The body is `{"detail": "<message>"}`, with one of
these messages. When several apply, the first in this order is returned.

| # | Case | `detail` |
|---|------|----------|
| 1 | `message_id` is not a whole number | `message_id must be a whole number` |
| 2 | Body is not a JSON object | `request body must be a JSON object` |
| 3 | `rating` missing, empty, null, not a string, or not exactly `up` or `down` | `rating must be "up" or "down"` |
| 4 | `reason` is not a string, or not on the list | `reason must be one of: incorrect, unclear, wanted_a_person, other` |
| 5 | `reason` given with `rating` `up` | `reason is only allowed with a "down" rating` |
| 6 | `comment` is not a string | `comment must be a string` |
| 7 | `comment` is longer than 1000 characters | `comment must be at most 1000 characters` |
| 8 | The message exists but is a user message | `feedback is only allowed on assistant messages` |

Cases 1 to 7 are checked before the database is read. Case 8 is checked after the message is
found.

**404**: no message has this id. Nothing is stored.

```json
{ "detail": "message not found" }
```

**500**: database unavailable (FastAPI's default handling, as for the other endpoints).

## Existing endpoints (unchanged)

| Endpoint | Note |
|----------|------|
| `GET /api/chat/{session_id}/history` | Does not return feedback (FR-019). Message ids it returns work in the feedback endpoint. |
| `GET /api/sessions` | Unchanged. |
| `GET /api/health` | Unchanged. |

## Test obligations (Principle IV)

The backend pytest suite MUST cover each of these. Each refusal test also checks that no
`feedback` row exists afterwards (FR-014).

1. **Chat response**: it has exactly `session_id`, `reply`, `intent` and `message_id`. The
   `message_id` is the id of the stored assistant message, for an agent reply and for a mock
   reply. The existing fields are unchanged.
2. **Rate up** and **rate down** return 200 with the response above, and store one row.
3. **Mock reply**: feedback on a message whose `source` is `mock` is accepted.
4. **User message** returns 400 with the case 8 message.
5. **Unknown id** returns 404. A non-numeric id (`abc`), a negative id and a 19-digit id
   return 400 with the case 1 message.
6. **Bad rating**: missing, `null`, empty, `"Up"`, `"thumbs_up"`, `true` and `5` each return 400.
7. **Reasons**: each of the four values is accepted with `down`. An unlisted value, an empty
   string, `"Incorrect"` and `5` return 400. Any reason with `up` returns 400. Missing or
   `null` is accepted and stored as no reason.
8. **Comments**: a comment is accepted with `up` and with `down`. A blank comment is stored
   as no comment. 1000 characters is accepted, and 1001 returns 400. A non-string returns 400.
9. **Bad body**: a body that is not JSON and a JSON array each return 400.
10. **Replace**: a second submission leaves one row with the new rating, and reason and comment
    cleared when omitted. Switching from `down` with a reason and comment to `up` works.
11. **Idempotent**: submitting identical values twice returns 200 both times and leaves the
    row, including `updated_at`, as it was.
12. **Race**: when the insert hits the unique constraint because another request created the
    row first, the retry updates that row and returns 200. (Simulated in the test.)
13. **trace_id**: the response has `null`, and a `trace_id` sent in the body is ignored.
14. **No side effects on existing behaviour**: the full existing suite passes. The only edits
    to existing tests are the two assertions that compare the whole chat response body.
