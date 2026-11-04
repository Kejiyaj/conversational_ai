# Feature Specification: Answer Feedback

**Feature Branch**: `002-answer-feedback`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Answer feedback, per requirement C.9.4.1-S1 (Feature list & key user stories) and "Feedback loop" (Feature listv02) in the requirements workbook. Backend: POST /api/messages/{message_id}/feedback. Rating "up" or "down". On "down", an optional reason from: incorrect, unclear, wanted_a_person, other (list pending approval). Optional free-text comment. Store in a new feedback table linked to the message (the turn). Add a nullable trace_id, to be populated once agent tracing exists. Only assistant messages can receive feedback. Add message_id to the POST /api/chat response as an additive field; existing fields unchanged. Out of scope: recording escalation reasons as feedback (needs escalation), feedback in history. Open question: should recommendation cards also be rateable?"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Rate an answer (Priority: P1)

After the assistant answers, the user can mark that answer as helpful ("up") or not helpful
("down"). To do this, the client needs to know which answer was just given, so each chat
reply identifies the assistant message it contains. The system records the rating against
that answer and confirms it.

**Why this priority**: this is the core of the feedback loop. A recorded thumbs-up or
thumbs-down tells the team which answers work, and it is useful on its own, without reasons
or comments.

**Independent Test**: send a chat message and take the message id from the reply. Submit a
rating of "up" for it. The system confirms it, and the rating is stored against that answer.

**Acceptance Scenarios**:

1. **Given** the user has sent a chat message, **When** the reply arrives, **Then** the reply
   includes the id of the assistant message it created, alongside all the fields it already
   had.
2. **Given** an assistant answer exists, **When** a rating of "up" is submitted for it,
   **Then** the system confirms success and records the rating against that answer.
3. **Given** an assistant answer exists, **When** a rating of "down" is submitted for it,
   **Then** the system confirms success and records the rating against that answer.
4. **Given** an answer that came from the fallback responder rather than the agent, **When**
   a rating is submitted for it, **Then** it is accepted like any other assistant answer.

---

### User Story 2 - Reject feedback that doesn't make sense (Priority: P1)

The system accepts feedback only on assistant messages, and only when the rating, reason and
comment are valid together. Anything else is refused with a clear message, and nothing is
stored.

**Why this priority**: feedback data is only useful if every record is about a real
assistant answer and is internally consistent. This protects the data from the first
release.

**Independent Test**: submit feedback for a user message, for a message that doesn't exist,
with a rating other than "up" or "down", and with a reason on an "up" rating. Each is refused
with a clear message, and no feedback is stored.

**Acceptance Scenarios**:

1. **Given** a message sent by the user, **When** feedback is submitted for it, **Then** the
   system refuses it with a clear message and stores nothing.
2. **Given** no message exists with the given id, **When** feedback is submitted for it,
   **Then** the system reports that the message was not found and stores nothing.
3. **Given** an assistant answer exists, **When** feedback is submitted with a rating that is
   missing, empty, or anything other than "up" or "down", **Then** the system refuses it with
   a clear message and stores nothing.
4. **Given** the given message id is not a valid id at all, **When** feedback is submitted,
   **Then** the system refuses it with a clear message and stores nothing.
5. **Given** an assistant answer exists, **When** a rating of "up" is submitted together with
   a reason, **Then** the system refuses it with a clear message and stores nothing.

---

### User Story 3 - Say why an answer was not helpful (Priority: P2)

When the user rates an answer "down", they can optionally say why by picking one reason from
a short list: `incorrect`, `unclear`, `wanted_a_person` or `other`. The reason is stored with
the rating, so the team can see why answers fail and not just that they fail.

**Why this priority**: a reason makes a "down" rating actionable, but a rating alone is
already useful, so this builds on User Story 1.

**Independent Test**: submit a "down" rating with the reason `unclear` for one answer, and a
"down" rating with no reason for another. Both are accepted, and the reason is stored only
for the first.

**Acceptance Scenarios**:

1. **Given** an assistant answer exists, **When** a "down" rating is submitted with the
   reason `incorrect`, `unclear`, `wanted_a_person` or `other`, **Then** the rating and the
   reason are stored together.
2. **Given** an assistant answer exists, **When** a "down" rating is submitted with no
   reason, **Then** it is accepted and stored with no reason.
3. **Given** an assistant answer exists, **When** a "down" rating is submitted with a reason
   that is not on the list, **Then** the system refuses it with a clear message and stores
   nothing.
4. **Given** the user picked `wanted_a_person`, **When** the feedback is stored, **Then** it
   is recorded only as a reason for the rating. Nothing is escalated.

---

### User Story 4 - Explain a rating with a comment (Priority: P2)

With either rating, the user can add a short free-text comment, for example what was wrong
or what was good. The comment is optional and is stored with the rating.

**Why this priority**: a comment captures detail that a fixed list can't, but it is an
optional extra on top of User Story 1.

**Independent Test**: submit a rating with a comment for one answer and a rating with no
comment for another. Both are accepted, and the comment is stored only for the first.

**Acceptance Scenarios**:

1. **Given** an assistant answer exists, **When** a rating is submitted with a comment,
   **Then** both are stored together, whether the rating is "up" or "down".
2. **Given** an assistant answer exists, **When** a rating is submitted with no comment,
   **Then** it is accepted and stored with no comment.
3. **Given** a comment that is blank or only whitespace, **When** it is submitted, **Then** it
   is treated as no comment.
4. **Given** a comment longer than the allowed length, **When** it is submitted, **Then** the
   system refuses it with a clear message and stores nothing.

---

### User Story 5 - Change a previous rating (Priority: P3)

The user can change their mind. Submitting feedback again for the same answer replaces the
earlier feedback instead of adding a second record.

**Why this priority**: people mis-click or reconsider, and without this an answer could end
up with conflicting ratings that skew the results. It is less important than recording
feedback in the first place.

**Independent Test**: rate an answer "down" with the reason `unclear` and a comment, then
submit "up" for the same answer. The answer ends up with a single rating, "up", with no
reason and no comment.

**Acceptance Scenarios**:

1. **Given** an answer already has feedback, **When** new feedback is submitted for it,
   **Then** the new rating, reason and comment replace the earlier ones, and the answer still
   has exactly one feedback record.
2. **Given** an answer already has a reason or comment, **When** new feedback is submitted
   without them, **Then** the earlier reason and comment are cleared.
3. **Given** the same feedback is submitted twice in a row, **When** the second submission
   arrives, **Then** it succeeds and leaves the stored feedback as it was.

---

### Edge Cases

- **Rating spelled differently**: "Up", "UP", "thumbs_up", `true` or an empty value are
  refused. Only exactly "up" or "down" is accepted.
- **Reason on an "up" rating**: refused, because reasons only apply to "down".
- **Reason spelled differently or not on the list**: `Incorrect`, `wrong` or an empty string
  are refused. A missing or null reason means no reason.
- **Feedback for a user message**: refused, even though the message exists.
- **Message id that doesn't exist**: reported as not found, which is different from the
  "not an assistant message" refusal.
- **Message id that is not a number** (for example `abc`): refused with a clear message.
- **Comment at exactly the maximum length**: accepted. One character over: refused.
- **Two submissions for the same answer at nearly the same moment**: the answer ends up with
  exactly one feedback record, holding the values of whichever submission was processed last.
- **Feedback for a fallback answer**: accepted. The feedback data can still be told apart
  from agent-answer feedback, because each answer already records where it came from.
- **A failed submission**: leaves nothing behind. There is never a partial feedback record.
- **Tracing doesn't exist yet**: the trace identifier is empty on every feedback record, and
  that is expected, not an error.
- **Older clients that don't know about the new message id**: keep working, because the
  existing reply fields are unchanged.
- **Recommendation cards**: an answer that contains cards is rated as one answer. The rating
  covers the text and the cards together, and a single card can't be rated on its own
  (FR-018).

## Requirements *(mandatory)*

### Functional Requirements

**Submitting feedback**

- **FR-001**: The system MUST let a client submit feedback for a single message, identified
  by its message id, through `POST /api/messages/{message_id}/feedback`. The request carries
  a `rating`, and optionally a `reason` and a `comment`.
- **FR-002**: The `rating` MUST be exactly `"up"` or `"down"`. A missing, empty or any other
  value MUST be refused with a client error and a clear message, and nothing is stored.
- **FR-003**: The `reason` MUST be optional and MUST be allowed only with a `"down"` rating.
  When present, it MUST be one of `incorrect`, `unclear`, `wanted_a_person` or `other`. A
  reason with an "up" rating, or a value not on the list, MUST be refused with a client error
  and a clear message, and nothing is stored. The reason is optional, as in C.9.4.1-S1.
- **FR-004**: The list of reasons in FR-003 is provisional, pending approval. The value
  `other` is in neither source and is kept in the provisional list as an addition. Changing the list
  MUST be a spec-level change and MUST NOT require changing how any other part of the
  feedback works.
- **FR-005**: The `comment` MUST be optional and MUST be allowed with either rating. A
  missing, null, blank or whitespace-only comment MUST be stored as no comment. Allowing a
  comment with "up" is an addition beyond the sources, which mention a comment only on
  "down".
- **FR-006**: A comment MUST be at most 1000 characters long. A longer comment MUST be refused
  with a client error and a clear message, and nothing is stored.
- **FR-007**: The system MUST accept feedback only for assistant messages. Feedback for a user
  message MUST be refused with a client error and a clear message, and nothing is stored.
- **FR-008**: If no message exists with the given id, the system MUST report "not found" and
  store nothing. If the id is not a valid message id at all, it MUST be refused with a client
  error.
- **FR-009**: Replies from the fallback responder MUST be treated like agent replies for the
  purposes of feedback. Feedback MUST NOT be refused because of a reply's source.

**Storing feedback**

- **FR-010**: Accepted feedback MUST be stored persistently as a feedback record linked to
  the assistant message (the turn) it rates. The record holds the rating, the optional
  reason, the optional comment, an optional trace identifier, and when the feedback was first
  given and last changed.
- **FR-011**: The feedback record MUST have a trace identifier that is empty (null) by
  default. Clients MUST NOT be able to set it. It is filled in by the system once agent
  tracing exists, and until then it stays empty.
- **FR-012**: A message MUST have at most one feedback record. Submitting feedback for a
  message that already has some MUST replace the earlier rating, reason and comment. It MUST
  NOT add a second record, and omitting the reason or comment MUST clear the earlier one.
- **FR-013**: Submitting the same feedback again MUST succeed and leave the stored feedback
  unchanged.
- **FR-014**: A submission MUST be all or nothing. A refused or failed submission MUST leave
  no feedback record and MUST NOT change any message or conversation.
- **FR-015**: A successful submission MUST return a confirmation that includes the message
  id, the stored rating, reason and comment (each empty if none), the trace identifier
  (empty today), and when the feedback was given.

**Identifying the answer to rate**

- **FR-016**: The `POST /api/chat` response MUST include a new field, `message_id`, holding
  the id of the assistant message created for that reply. It MUST be present for every
  successful reply, whether it came from the agent or the fallback responder.
- **FR-017**: The new `message_id` field MUST be purely additive. The existing fields of the
  `POST /api/chat` response (`session_id`, `reply`, `intent`) and the request MUST keep their
  names, types and meaning, so existing clients keep working unchanged. The history and
  health responses MUST NOT change.

**Recommendation cards**

- **FR-018**: Recommendation cards MUST NOT be rated separately in this version. When an
  assistant message contains recommendation cards, the rating, reason and comment for that
  message cover the whole answer, cards included. Rating individual cards is deferred until
  recommendation cards exist and MUST be revisited then.

**Boundaries and documentation**

- **FR-019**: This feature MUST NOT record escalations, and choosing `wanted_a_person` MUST NOT
  trigger or record one. Feedback MUST NOT be returned by the history endpoint.
- **FR-020**: Refusals caused by invalid input MUST use the project's standard error shape,
  `{"detail": "<message>"}`, with a clear, human-readable message.
- **FR-021**: Feedback storage MUST be added through the project's normal database migration
  process, so a fresh database and an existing one both reach the same schema.
- **FR-022**: The new endpoint, its request and response, and the new `message_id` field MUST
  be documented in `README.md` in the same change that adds them.

### Key Entities

- **Feedback**: a user's judgement of one assistant answer (turn). Attributes: the message it
  belongs to, a rating (`up` or `down`), an optional reason (only with `down`), an optional
  comment, an optional trace identifier (empty until tracing exists), when it was first
  given, and when it was last changed. A message has at most one feedback record.
- **Message**: one turn in a conversation, either from the user or from the assistant. It
  already exists in the system. A message can have zero or one feedback record, and only
  assistant messages can have one. A chat reply now also tells the client the id of the
  assistant message it created.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of successful chat replies include the id of the assistant message they
  created, and a rating submitted with that id is accepted.
- **SC-002**: 100% of valid feedback submissions for assistant answers are confirmed and still
  stored after the system is restarted.
- **SC-003**: 100% of submissions for user messages, for unknown ids, or with an invalid
  rating, reason or comment are refused with a clear message, and none of them leaves a
  feedback record.
- **SC-004**: After any number of submissions for the same answer, including simultaneous
  ones, the answer has exactly one feedback record.
- **SC-005**: A user gets confirmation of a submitted rating within 1 second under normal use.
- **SC-006**: Existing clients are unaffected. Every existing automated test passes without
  modification, and the existing fields of the chat reply, the history and the health check
  are unchanged.
- **SC-007**: The team can tell, for every stored feedback record, which answer it is about,
  whether that answer came from the agent or the fallback responder, whether the rating was
  up or down, and, for "down", the reason if one was given.

## Assumptions

- **Traceability**: the feature follows requirement C.9.4.1-S1 (Customer feedback capture and
  review) and "Feedback loop" in Feature listv02 of the requirements workbook. See Source
  Traceability at the end of this spec for what each source asks for and how this spec
  covers it. The workbook itself is not stored in this repository.
- "The user" in this spec is the person chatting. The sources call this person the
  participant.
- There is no login, as in the rest of the system. Anyone who knows a message id can submit
  feedback for it, and access control is out of scope until accounts exist.
- The reason list is provisional until it is approved. The four values are stored as given,
  as plain codes, so a change to the list affects only the allowed values.
- A reason only makes sense with a "down" rating, so it is refused with "up". A comment is
  allowed with either rating.
- The comment limit of 1000 characters is a sensible default for a short note. It can be
  changed without affecting the rest of the design.
- Only one rating per message is kept, and a resubmission replaces it. This is a default, as
  the request does not say. A history of rating changes is out of scope.
- The trace identifier is a placeholder for future agent tracing. This feature adds the empty
  field only. How it gets filled in, and what an identifier looks like, is decided when
  tracing is specified.
- Choosing `wanted_a_person` records only the user's reason. Recording escalations as
  feedback needs an escalation feature that does not exist yet, so it is out of scope.
- Showing a rating the user gave earlier, by returning feedback from the history endpoint, is
  out of scope. A client therefore cannot show an earlier rating after a conversation is
  reopened.
- Recommendation cards do not exist in the system yet. Feedback is given per assistant message
  (the turn), so cards inside a message are covered by that message's rating. Revisit
  rating individual cards once recommendation cards exist. That would need a way to identify
  a card, and so a new spec.
- Reading, listing, deleting or aggregating feedback (dashboards, reports, export) is out of
  scope. This version only collects feedback.
- Feedback is kept for as long as its message is kept. This feature adds no expiry rules.
- The affected consumers of the new `message_id` field are the frontend, which may start
  using it and is not required to, and the backend. The agent is not involved.
- Frontend changes (thumbs buttons, reason picker, comment box) are out of scope. This feature
  covers the backend only.
- Recording an escalation's reason as feedback is likely to need a feedback record that has
  no user rating. This feature does not build that, but the design MUST keep the rating
  relaxable, so that such records can be added later without reworking the feedback data.
- The exact schema, constraints and error status codes are decided in the plan.

## Source Traceability

Sources: **C.9.4.1-S1** (Customer feedback capture and review) and **Feature listv02,
"Feedback loop"**, both in the requirements workbook. Status: Covered, Partial, Not covered,
or Open (waiting on a decision outside this spec).

| Source | What it asks for | Status | Where |
|--------|------------------|--------|-------|
| C.9.4.1-S1 | A participant can rate a response | Covered | US1, FR-001, FR-016 |
| C.9.4.1-S1 | Thumbs up and down on a response | Covered for the backend. The thumbs controls are frontend work, out of scope | FR-002 |
| C.9.4.1-S1 | On thumbs down, optional reasons (for example incorrect, unclear, wanted a person) | Covered. This spec adds `other`, which is in neither source | FR-003 |
| C.9.4.1-S1 | On thumbs down, free text offered | Covered, and this spec also accepts a comment with "up" | FR-005 |
| C.9.4.1-S1 | An escalation's reason is recorded as feedback | Not covered. Deferred until escalation exists | FR-019 |
| C.9.4.1-S1 | Done: reason list approved | Open. The list is provisional | FR-004 |
| C.9.4.1-S1 | Done: feedback records linked to trace IDs | Partial. The field exists and is empty until tracing exists | FR-011 |
| Feedback loop | A reply or recommendation can get thumbs up or down | Partial. Replies are covered. Recommendations are rated only as part of their message | FR-018 |
| Feedback loop | On thumbs down, pick a reason (incorrect, unclear) | Covered. The source names two reasons and this spec allows four. The reason is optional, per C.9.4.1-S1 | FR-003 |
| Feedback loop | Add a comment | Covered | FR-005 |
| Feedback loop | Output: feedback record linked to the turn | Covered | FR-010 |

Added by this spec, and not asked for by either source: the `message_id` field on the chat
response (needed to identify the turn to rate), a comment allowed with "up", the reason
`other`, a resubmission replacing earlier feedback, the 1000-character comment limit,
refusing a reason on an "up" rating, and the trace identifier being set by the system only.

Notes on the gaps:

- **Thumbs UI**: the sources' acceptance criteria about showing thumbs, reasons and free text
  are frontend work. They belong in a separate frontend spec, owned by Vinod. This spec
  covers the backend only.
- **Review and reporting**: C.9.4.1-S1 is titled "capture and review", but reading, listing
  and reporting on feedback are out of scope here. They are a follow-up.
- **Escalation reason as feedback**: deferred until escalation exists (FR-019). The design
  keeps the rating relaxable for it.
- **Individual recommendation rating**: deferred until recommendation cards exist (FR-018).
