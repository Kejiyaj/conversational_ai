# Feature Specification: Answer Feedback in the Chat UI

**Feature Branch**: `004-answer-feedback-ui`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Answer feedback in the chat UI, using the existing backend API from spec 002 (message_id in the POST /api/chat response, and POST /api/messages/{message_id}/feedback). Full flow: thumbs up / thumbs down under each assistant reply; on thumbs down, offer the four reasons (incorrect, unclear, wanted a person, other) and an optional comment up to 1000 characters; a comment is also allowed with thumbs up. Re-rating replaces the earlier feedback. Past ratings are not shown after a reload or reopening a chat, because history does not return feedback; accept this for the POC as a known limitation, with no backend change. Built on the spec 003 UI (shadcn AI Elements, Principal theme)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate an answer (Priority: P1)

Under each assistant reply, the customer sees two small controls: helpful (thumbs up) and not
helpful (thumbs down). One tap records their rating, and the chosen control stays highlighted so
they can see it was saved.

**Why this priority**: This is the core of the feedback loop. A single rating per answer already
tells the team which answers work, with no extra effort from the customer.

**Independent Test**: Send a message, tap thumbs up under the reply, and confirm the control is
shown as selected and the rating is stored against that reply.

**Acceptance Scenarios**:

1. **Given** an assistant reply is on screen, **When** the customer looks under it, **Then** they see a "Helpful" and a "Not helpful" control, neither selected.
2. **Given** an unrated reply, **When** the customer taps "Helpful", **Then** the rating is saved and "Helpful" is shown as selected.
3. **Given** an unrated reply, **When** the customer taps "Not helpful", **Then** the rating is saved and "Not helpful" is shown as selected.
4. **Given** a reply that came from the fallback (mock) responder, **When** the customer rates it, **Then** it is accepted like any other reply.
5. **Given** a chat reopened from the sidebar, **When** its replies are shown, **Then** each reply can be rated, and starts unrated.
6. **Given** the customer's own messages and the "Something went wrong." reply, **When** they are shown, **Then** no rating controls appear on them.

---

### User Story 2 - Say why an answer was not helpful (Priority: P2)

After tapping "Not helpful", the customer is offered a short choice of reasons (Incorrect,
Unclear, I wanted a person, Other) and an optional comment box. They can pick one reason, write a
comment, both, or neither, and send it. After tapping "Helpful", they can optionally add a
comment too.

**Why this priority**: Reasons and comments explain a bad answer and make the feedback
actionable, but a plain rating is already useful without them.

**Independent Test**: Tap "Not helpful", choose "Unclear", type a comment, send it, and confirm
the stored feedback has the down rating, the reason and the comment.

**Acceptance Scenarios**:

1. **Given** the customer tapped "Not helpful", **When** the follow-up appears, **Then** it shows the four reasons, a comment box and a Send control, and the down rating is already saved.
2. **Given** the follow-up is open, **When** the customer picks a reason and sends, **Then** the feedback is updated with that reason and the follow-up closes with a short thank-you.
3. **Given** the follow-up is open, **When** the customer writes a comment and sends, **Then** the comment is stored with the rating.
4. **Given** the customer tapped "Helpful", **When** they choose to add a comment, **Then** a comment box (with no reason list) appears and the comment can be sent.
5. **Given** the follow-up is open, **When** the customer dismisses it without sending, **Then** the plain rating stays saved and nothing else changes.
6. **Given** the comment box, **When** the customer types, **Then** they can see how many characters remain, and cannot enter more than 1000.

---

### User Story 3 - Change a rating (Priority: P3)

A customer who changes their mind can tap the other control. The new rating replaces the old one.

**Why this priority**: Mistaps happen; correcting them keeps the data honest. It is less common
than rating in the first place.

**Independent Test**: Rate a reply "Not helpful" with a reason, then tap "Helpful", and confirm
the stored feedback is now "up" with no reason.

**Acceptance Scenarios**:

1. **Given** a reply rated "Not helpful", **When** the customer taps "Helpful", **Then** the rating is replaced, "Helpful" is shown as selected, and any reason is cleared.
2. **Given** a reply rated "Helpful", **When** the customer taps "Not helpful", **Then** the rating is replaced and the reason follow-up is offered.
3. **Given** a rated reply, **When** the customer taps the already selected control again, **Then** nothing changes.

---

### Edge Cases

- Saving feedback fails (network or server error): the customer sees a short "Couldn't save your feedback" message with Retry, and the controls show the last rating that was actually saved.
- The customer taps controls quickly or twice: only one save is in flight per reply at a time, and the final state on screen matches what was stored.
- A reply has no message id (the "Something went wrong." reply, or a future reply without one): no rating controls are shown.
- The customer switches to another chat and back during the same visit: ratings given in this visit are still shown.
- The page is reloaded or reopened later: earlier ratings are not shown (known limitation; history does not return feedback). Rating again replaces the stored feedback, so no duplicates are created.
- A comment of only spaces is treated as no comment.
- Rating while another reply is still pending in the same chat works and does not block sending.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Every assistant reply that has a message id MUST show a "Helpful" (up) and a "Not helpful" (down) control. User messages and replies without a message id MUST NOT show them.
- **FR-002**: Tapping a control MUST save that rating immediately, without any further step.
- **FR-003**: The selected rating MUST be shown on the control, and announced to assistive technology as selected.
- **FR-004**: After a "Not helpful" rating, the customer MUST be offered an optional single choice of reason from: Incorrect, Unclear, I wanted a person, Other; and an optional comment.
- **FR-005**: After a "Helpful" rating, the customer MUST be able to add an optional comment. No reasons are offered with "Helpful".
- **FR-006**: The comment MUST be limited to 1000 characters, with the remaining count visible. A comment that is empty or only whitespace MUST be sent as no comment.
- **FR-007**: Sending a reason or comment MUST update the stored feedback for that reply, keeping its rating.
- **FR-008**: Tapping the other control MUST replace the stored rating; switching to "Helpful" MUST clear any reason.
- **FR-009**: If saving fails, the customer MUST see a short error with a Retry action, and the controls MUST show the last successfully saved state.
- **FR-010**: Only one save per reply MUST be in progress at a time; controls for that reply MUST be disabled while it is saving.
- **FR-011**: Ratings given during the current visit MUST still be shown when the customer switches chats and comes back. They are not expected to survive a page reload (no backend change).
- **FR-012**: Choosing "I wanted a person" MUST only record the reason. It MUST NOT start a handoff to an advisor (out of scope, see spec 002 FR-019).
- **FR-013**: All controls MUST be keyboard operable and use the Principal theme from spec 003.
- **FR-014**: The frontend ↔ backend contract MUST NOT change; the UI uses the fields and endpoint already defined in spec 002.

### Key Entities

- **Feedback (as seen by the customer)**: one per assistant reply; a rating (helpful or not helpful), an optional reason (only with not helpful), an optional comment. Stored by the backend; the UI keeps a copy for the current visit only.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A customer can rate a reply with a single tap, and see it confirmed on screen within 1 second under normal conditions.
- **SC-002**: A customer can rate "Not helpful", pick a reason and add a comment in under 20 seconds.
- **SC-003**: 100% of ratings shown as selected on screen match what is stored for that reply.
- **SC-004**: Every feedback control can be reached and used with the keyboard alone.
- **SC-005**: All existing frontend tests still pass, and every behavior and edge case above has an automated test.

## Assumptions

- Uses the backend from spec 002 as merged on `main`: `message_id` in each chat reply and the feedback endpoint. The history endpoint already returns message ids, so reopened chats can be rated.
- Showing earlier ratings after a reload is out of scope for the POC (agreed with the frontend owner). A later spec can ask the backend to return feedback with history.
- The reason labels shown to customers ("Incorrect", "Unclear", "I wanted a person", "Other") map to the backend codes `incorrect`, `unclear`, `wanted_a_person`, `other`. The list is provisional, as in spec 002.
- The rating is saved on the first tap; the reason and comment are a second, optional step that updates the same feedback. This keeps the main action to one tap.
- No login exists; feedback is anonymous, as in the rest of the POC.
- Rating individual cards inside a reply is out of scope (spec 002 FR-018).
- Builds on the spec 003 UI; this branch is stacked on `003-shadcn-ai-elements`.
