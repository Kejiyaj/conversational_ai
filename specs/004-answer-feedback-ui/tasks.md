---

description: "Task list for spec 004: answer feedback in the chat UI"
---

# Tasks: Answer Feedback in the Chat UI

**Input**: Design documents from `/specs/004-answer-feedback-ui/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/frontend-api.md, quickstart.md

**Tests**: Required (constitution IV, SC-005). Write each story's tests first and confirm they fail. Existing test files (`App.test.tsx`, `Sidebar.test.tsx`, `sessionStore.test.ts`, `Composer.test.tsx`, `theme.test.ts`) MUST NOT be edited; `helpers.ts` may only be extended additively.

**Organization**: Tasks are grouped by user story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3
- All paths are relative to the repository root

## Rules for every task

- Every feedback request sends the full desired state: `rating`, plus `reason` and `comment` when present; omit them (do not send empty strings) when absent (research R1).
- Controls render from the last state the backend **confirmed**, never optimistically (SC-003).
- Keep the spec 003 test hooks (`message`, `pending`, `layout`/`open`, `backdrop`, `session-title`, "Type a message", button names) untouched.
- Use theme variables only; no hard-coded colors (spec 003 theme test enforces this).

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Run `npx shadcn@latest add toggle-group -y </dev/null` in `frontend/`; confirm it creates `frontend/src/components/ui/toggle.tsx` and `frontend/src/components/ui/toggle-group.tsx` and adds no new npm packages to `frontend/package.json`
- [X] T002 [P] In `frontend/src/api.ts`: add `message_id: number | null` to `ChatResponse`; add types `FeedbackRating = "up" | "down"`, `FeedbackReason = "incorrect" | "unclear" | "wanted_a_person" | "other"`, `Feedback = { rating: FeedbackRating; reason?: FeedbackReason; comment?: string }`, `FeedbackResponse` (fields per `specs/002-answer-feedback/contracts/feedback-api.md`); add `submitFeedback(messageId: number, feedback: Feedback): Promise<FeedbackResponse>` that POSTs JSON to `/api/messages/${messageId}/feedback` using the existing `request` helper (contracts/frontend-api.md)
- [X] T003 [P] Extend the fake backend in `frontend/src/__tests__/helpers.ts` additively: `POST /api/chat` also returns `message_id` (the id of the assistant message it creates); add `feedback: Map<number, unknown>` (last body per message id) and `failFeedback: boolean` to `Server`; handle `POST /api/messages/{id}/feedback` → 500 when `failFeedback`, 404 if no message has that id, 400 `feedback is only allowed on assistant messages` for a user message, else store the body and return 200 with `{ message_id, rating, reason: reason ?? null, comment: comment ?? null, trace_id: null, created_at, updated_at }`. Add optional `holdFeedback: Promise<void> | null` like `holdChat`
- [X] T004 Verify in `frontend/`: `npx tsc -b`, `npm test` (all 31 existing tests pass), `npm run build`

**Checkpoint**: API client and test fake backend ready; UI unchanged.

---

## Phase 2: Foundational (Blocking Prerequisites)

- [X] T005 In `frontend/src/App.tsx`: add `id?: number` to the frontend `Message` type; set it from `message_id` on a live reply (only when it is a number) and from `m.id` when mapping history; leave it unset on the failed reply. Keep all existing send/stale-reply logic unchanged (data-model.md)

**Checkpoint**: Every rateable reply carries its id.

---

## Phase 3: User Story 1 - Rate an answer (Priority: P1) 🎯 MVP

**Goal**: Thumbs up/down under each assistant reply with an id; one tap saves; selected state shown; errors with Retry; ratings kept for the visit.

**Independent Test**: Feedback.test.tsx US1 cases pass; quickstart manual steps 1, 2, 5, 6.

### Tests for User Story 1 (write first, confirm they FAIL)

- [X] T006 [US1] Create `frontend/src/__tests__/Feedback.test.tsx` (use `installServer`/`seed` from helpers). Cases: (a) after a reply, "Helpful" and "Not helpful" buttons exist under it with `aria-pressed="false"`, and none exist for the user message; (b) clicking "Helpful" POSTs `{ "rating": "up" }` to `/api/messages/<message_id>/feedback` and then shows `aria-pressed="true"` on "Helpful"; (c) clicking "Not helpful" POSTs `{ "rating": "down" }` and marks it pressed; (d) the "Something went wrong." reply has no rating buttons; (e) a reopened chat's replies can be rated using the history `id`; (f) with `failFeedback`, clicking "Helpful" shows "Couldn't save your feedback" and a Retry button, both thumbs stay `aria-pressed="false"`; turning `failFeedback` off and clicking Retry saves and marks "Helpful" pressed; (g) while a save is held (`holdFeedback`), both thumbs for that reply are disabled; (h) rate a reply, open another chat, come back: the rating is still shown
- [X] T007 [US1] Run `npm test` in `frontend/`; confirm the T006 cases fail and all existing tests pass

### Implementation for User Story 1

- [X] T008 [US1] Create `frontend/src/FeedbackBar.tsx`: props `{ messageId: number; state: FeedbackState | undefined; onSubmit: (feedback: Feedback) => void; onRetry: () => void }` (types per data-model.md). Render two `Button variant="ghost" size="icon-sm"` with lucide `ThumbsUpIcon`/`ThumbsDownIcon`, `aria-label` "Helpful" / "Not helpful", `aria-pressed` from `state?.saved?.rating`, `disabled` while `state?.saving`. Selected thumb uses `text-primary`. Tapping the already-selected thumb does nothing. On `state?.error`, show a small `role="alert"` line "Couldn't save your feedback" with a `Button variant="link" size="sm"` "Retry"
- [X] T009 [US1] In `frontend/src/App.tsx`: hold `feedback: Map<number, FeedbackState>` in state (not reset by `showSession`/`newChat`, so it survives chat switches). Add `saveFeedback(messageId, feedback)`: if that reply is already saving, ignore; set `saving`, call `submitFeedback`, on success set `saved = feedback`, clear `error`; on failure set `error = { attempted: feedback }`; always clear `saving`. Retry calls `saveFeedback(messageId, error.attempted)`
- [X] T010 [US1] In `frontend/src/App.tsx`: for assistant messages with a numeric `id`, render `<MessageFooter><FeedbackBar … /></MessageFooter>` inside the message row, after `MessageContent`. The thumbs' first tap sends the full state: `{ rating }` plus any existing `comment` from `saved` (reason only when the new rating is "down" and one exists)
- [X] T011 [US1] Run `npx tsc -b` and `npm test` in `frontend/`; all T006 cases and all existing tests pass

**Checkpoint**: Rating works end to end (MVP).

---

## Phase 4: User Story 2 - Say why an answer was not helpful (Priority: P2)

**Goal**: Follow-up with reasons (down only) and comment (both ratings), Send, dismiss, thank-you.

**Independent Test**: Feedback.test.tsx US2 cases pass; quickstart manual step 3.

### Tests for User Story 2 (write first, confirm they FAIL)

- [X] T012 [US2] Add a `describe("US2 …")` block to `frontend/src/__tests__/Feedback.test.tsx`. Cases: (a) after "Not helpful" is saved, the follow-up shows the four reasons "Incorrect", "Unclear", "I wanted a person", "Other", a comment box and "Send"; (b) choosing "Unclear" and Send POSTs `{ "rating": "down", "reason": "unclear" }`, then the follow-up closes and "Thanks for your feedback" shows; (c) a comment with a reason POSTs `{ rating: "down", reason, comment }` with the comment exactly as typed; (d) after "Helpful", an "Add a comment" button opens a comment box with no reasons; Send POSTs `{ "rating": "up", "comment": "…" }`; (e) a whitespace-only comment is not sent (body has no `comment` key); (f) the comment box has `maxLength` 1000 and shows "1000 characters left", updating as you type; (g) dismissing the follow-up ("Close") sends nothing more and keeps "Not helpful" pressed; (h) "I wanted a person" is sent as `wanted_a_person` and no other request is made. **Done: also added a case for a failed Send (panel stays open with Retry). The follow-up button is named "Send feedback" so it does not clash with the composer's "Send".**
- [X] T013 [US2] Run `npm test`; confirm T012 cases fail

### Implementation for User Story 2

- [X] T014 [US2] In `frontend/src/FeedbackBar.tsx`: add the follow-up panel, open after a "down" save succeeds and when the customer clicks "Add a comment" (shown after an "up" save). Reasons (down only): `ToggleGroup type="single"` with `ToggleGroupItem`s labelled per data-model.md, values the backend codes, `aria-label="Reason"`. Comment: `Textarea` with `maxLength={1000}`, `aria-label="Comment"`, and a counter "N characters left". Buttons: "Send" (`Button size="sm"`) and "Close" (`Button variant="ghost" size="sm"`). Send calls `onSubmit({ rating: saved.rating, reason?, comment? })`, omitting a blank comment and omitting reason when none is chosen
- [X] T015 [US2] In `frontend/src/App.tsx` / `FeedbackBar.tsx`: track `open` per reply (data-model.md); close the panel and show "Thanks for your feedback" (`text-sm text-muted-foreground`) after a successful Send; Close hides the panel without a request. A failed Send keeps the panel open with the error + Retry from US1. **Done: `open` is kept inside `FeedbackBar` (screen-only state), not in App's visit map; only confirmed feedback needs to survive chat switches.**
- [X] T016 [US2] Run `npx tsc -b` and `npm test`; all tests pass

**Checkpoint**: Reasons and comments work.

---

## Phase 5: User Story 3 - Change a rating (Priority: P3)

**Goal**: Switching thumbs replaces the stored feedback; "up" clears reason; same thumb is a no-op.

**Independent Test**: Feedback.test.tsx US3 cases pass; quickstart manual step 4.

### Tests for User Story 3 (write first, confirm they FAIL if not already passing)

- [X] T017 [US3] Add a `describe("US3 …")` block to `frontend/src/__tests__/Feedback.test.tsx`. Cases: (a) rate "Not helpful" with reason "incorrect" and a comment, then click "Helpful": the last POST is `{ "rating": "up", "comment": "<same comment>" }` (no reason) and "Helpful" is pressed; (b) rate "Helpful", then "Not helpful": POST `{ "rating": "down" }` (plus any comment) and the follow-up opens; (c) clicking the already-pressed thumb makes no request
- [X] T018 [US3] Run `npm test`; note which T017 cases already pass from T010's rules and which fail **Done: all three passed already (rules built into `rate()` in T010); confirmed meaningful by breaking the reason rule, which made case (a) fail.**

### Implementation for User Story 3

- [X] T019 [US3] Fix any failing T017 case in `frontend/src/App.tsx` / `frontend/src/FeedbackBar.tsx` (switching keeps the comment, drops the reason on "up", opens the follow-up on "down"); run `npx tsc -b` and `npm test`; all pass **Done: no fix needed.**

**Checkpoint**: All stories complete.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T020 [P] Add a short "Answer feedback" line to the frontend section of `README.md`: thumbs under replies use the spec 002 endpoint; ratings are kept for the visit only. API contract section unchanged
- [X] T021 Run `npx tsc -b`, `npm test`, `npm run build` in `frontend/`
- [X] T022 Run every manual step in `specs/004-answer-feedback-ui/quickstart.md` against the real backend and Postgres (including the `feedback` table check) and record results under a "Notes" heading in this file

---

## Dependencies & Execution Order

- **Setup**: T001; T002 and T003 in parallel; then T004
- **Foundational**: T005 after T004
- **US1**: T006 → T007 → T008 → T009 → T010 → T011
- **US2**: after US1 (follow-up builds on FeedbackBar): T012 → T013 → T014 → T015 → T016
- **US3**: after US2 (switching opens the follow-up): T017 → T018 → T019
- **Polish**: after US3; T020 in parallel with T021

## Parallel Example

```text
After T001: T002 (frontend/src/api.ts) and T003 (frontend/src/__tests__/helpers.ts) together
Polish: T020 (README.md) alongside T021
```

## Implementation Strategy

1. Setup + Foundational → no visible change (commit optional)
2. US1 → thumbs work end to end; **stop and validate**; commit (MVP)
3. US2 → reasons and comments; commit
4. US3 → re-rating; commit
5. Polish → README, quickstart run; commit

## Notes

Quickstart run on 2026-11-04 (Chrome, real backend on `:8000`, Postgres `convai-db`):

- Automated: `tsc -b` clean, 51/51 tests pass (31 existing unchanged; 20 new in `Feedback.test.tsx`), `npm run build` succeeds (JS 319 kB, 102 kB gzipped; +28 kB).
- Step 1–2: thumbs under each reply only; "Helpful" stored `up` for message 32.
- Step 3: "Not helpful" opened the follow-up; "Unclear" + comment stored `down | unclear | Didn't explain the income limits.` (message 34).
- Step 4: switching to "Helpful" stored `up | null | <same comment>`.
- Step 5: switching chats kept ratings; a page reload showed them unrated (known limitation).
- Step 6: backend stopped → "Couldn't save your feedback. Retry", thumbs kept the last saved rating; after restart, Retry stored `down` with the comment and opened the follow-up.
- Step 7: focus rings come from the shared Button/Toggle styles checked in spec 003; arrow-key movement between reasons is Radix ToggleGroup behavior and was not separately checked by hand.
- Deviations: follow-up `open` state lives in `FeedbackBar` (see T015); the follow-up's button is "Send feedback" (see T012).
