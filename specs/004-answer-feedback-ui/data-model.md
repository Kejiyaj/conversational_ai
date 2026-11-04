# Data Model: Answer Feedback in the Chat UI

No backend or database changes. Frontend view state only.

## Message (frontend view, extended)

`{ id?: number, role: "user" | "assistant", text: string, failed?: boolean }`

- `id`: the backend message id. Set from `message_id` on a live reply and from `id` in history. Absent on the failed reply.
- Rating controls are shown only when `role === "assistant"` and `id` is a number.

## FeedbackState (per assistant message, kept for the visit)

| Field | Type | Rules |
|---|---|---|
| `saved` | `Feedback \| null` | Last state the backend confirmed. Controls render from this. |
| `saving` | `boolean` | True while a request is in flight. Controls disabled. |
| `error` | `{ attempted: Feedback } \| null` | Set when the last save failed; Retry resends `attempted`. |
| `open` | `boolean` | Whether the reason/comment follow-up is shown. |

## Feedback (what is sent)

| Field | Rules (from spec 002 contract) |
|---|---|
| `rating` | `"up"` or `"down"` |
| `reason` | Only with `"down"`: `incorrect`, `unclear`, `wanted_a_person`, `other`; omitted for none |
| `comment` | At most 1000 characters; empty or whitespace-only is omitted |

Every request sends the full desired state (research R1).

## Reason labels

| Label shown | Code sent |
|---|---|
| Incorrect | `incorrect` |
| Unclear | `unclear` |
| I wanted a person | `wanted_a_person` |
| Other | `other` |

## State transitions

```
unrated --tap up/down--> saving --ok--> rated (down: follow-up opens)
                               \--fail--> error (controls show last saved) --Retry--> saving
rated --send reason/comment--> saving --ok--> rated (follow-up closes, "Thanks")
rated --tap other thumb--> saving --ok--> rated (reason cleared if now "up")
rated --tap same thumb--> no request
```
