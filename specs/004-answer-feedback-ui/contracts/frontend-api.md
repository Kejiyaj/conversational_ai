# Contract: Frontend use of the spec 002 feedback API

No contract change (FR-014, constitution I). This file records how the frontend uses what spec 002
defined in `specs/002-answer-feedback/contracts/feedback-api.md`.

## `frontend/src/api.ts` changes (additive)

```ts
export type ChatResponse = { session_id: string; reply: string; intent: string | null; message_id: number | null };

export type FeedbackRating = "up" | "down";
export type FeedbackReason = "incorrect" | "unclear" | "wanted_a_person" | "other";
export type Feedback = { rating: FeedbackRating; reason?: FeedbackReason; comment?: string };

// POST /api/messages/{messageId}/feedback. Throws on network failure or non-2xx, like the other calls.
export function submitFeedback(messageId: number, feedback: Feedback): Promise<FeedbackResponse>;
```

- The body always carries the full desired state; `reason` and `comment` are omitted (not sent as empty) when there is none.
- `comment` is trimmed for the "only whitespace" check, but a non-blank comment is sent exactly as typed.
- The response is not used to drive the UI beyond success/failure; the UI shows what it sent once the call succeeds.

## Errors the UI can hit

| Response | When | UI |
|---|---|---|
| 200 | Stored | Show the new state |
| 400 | Should not happen with valid UI input | Same as any failure: error + Retry |
| 404 | Message deleted | Same as any failure |
| 5xx / network | Backend or DB down | Same as any failure |
