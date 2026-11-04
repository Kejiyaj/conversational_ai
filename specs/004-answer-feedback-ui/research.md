# Research: Answer Feedback in the Chat UI

## R1. How the backend stores feedback

- **Finding**: `POST /api/messages/{message_id}/feedback` replaces the whole record on every call (`backend/app/feedback.py`, `save_feedback`). An omitted `reason` or `comment` **clears** the stored value.
- **Decision**: The UI keeps the full desired state per reply (`rating`, `reason`, `comment`) and always sends all three. The first tap sends `{rating}` with the current reason/comment (none yet); the follow-up sends `{rating, reason, comment}`; switching to "up" sends `{rating: "up", comment}` with no reason (FR-008) and keeps any comment.
- **Alternatives considered**: Sending only the changed field. Rejected: it would silently wipe the reason or comment.

## R2. Where message ids come from

- **Finding**: `POST /api/chat` returns `message_id` (integer, always set today; typed `integer | null`). `GET /api/chat/{id}/history` returns `id` for every message.
- **Decision**: Add `message_id: number | null` to `ChatResponse` in `frontend/src/api.ts` (additive, matches the contract), and carry an optional `id` on each frontend `Message`. Replies without an id (failed send, or a future `null`) get no controls (FR-001).

## R3. Components

- **Decision**:
  - Thumbs: two shadcn `Button` (`variant="ghost"`, `size="icon-sm"`) with lucide `ThumbsUp`/`ThumbsDown`, `aria-pressed` for the selected state (FR-003), labels "Helpful" / "Not helpful". Placed in AI Elements `MessageFooter` under the reply bubble.
  - Reasons: shadcn `toggle-group` (`type="single"`), Radix ToggleGroup: one optional choice, arrow-key navigation built in (FR-004, FR-013).
  - Comment: the existing shadcn `textarea` with `maxLength={1000}` and a "N characters left" counter (FR-006).
  - Follow-up: an inline panel under the reply (not a popover), so it works on narrow screens and keeps focus order simple.
- **Dependencies**: `npx shadcn@latest add toggle-group` adds `toggle.tsx` and `toggle-group.tsx`. Both use `radix-ui` and `cn`, already installed. **No new npm packages.**
- **Alternatives considered**: Radio buttons (fine semantically, but a chip row matches the Principal look better); shadcn `popover` for the follow-up (rejected: awkward on mobile, extra component).

## R4. Keeping ratings for the visit

- **Decision**: Hold feedback in `App` as a map keyed by message id (`Map<number, FeedbackState>`), outside the per-chat `messages` list, so switching chats and back still shows ratings (FR-011). Lost on reload by design.
- **Alternatives considered**: `localStorage` (offered to the owner, not chosen); backend history (out of scope).

## R5. Saving, errors and double taps

- **Decision**: Per reply, track `saved` (last state the server confirmed), `saving` and `error`. Controls are disabled while `saving` (FR-010). On failure, show "Couldn't save your feedback" with Retry that resends the attempted state, and render controls from `saved` (FR-009). Optimistic display is not used, so the screen always matches storage (SC-003).

## R6. Tests

- **Decision**: Extend the shared fake backend in `frontend/src/__tests__/helpers.ts` additively: return `message_id` from `POST /api/chat`, return `id`s it already has in history, and add the feedback endpoint (store last body per id, optional failure switch). Existing test files are not edited. New tests in `frontend/src/__tests__/Feedback.test.tsx`.
