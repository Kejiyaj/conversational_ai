# Feature Specification: Disclaimer Below the Message Box

**Feature Branch**: `006-input-disclaimer`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "i want to add a disclaimer below the input box on the UI"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See a standing disclaimer while chatting (Priority: P1)

A customer using the PFG Wealth Assistant always sees a short disclaimer directly below the message box,
before and during a conversation. It tells them, in one or two short lines, that the assistant is an AI,
that answers can be wrong, and that the answers are general information on demo data, not financial advice.
It stays visible without the customer having to scroll or open anything.

**Why this priority**: This is the whole feature. A financial assistant must set expectations before the
customer relies on an answer, and the place every customer looks before sending is the message box.

**Independent Test**: Open the app, start a new chat and an existing chat, on a wide and a narrow screen, and
confirm the disclaimer is visible directly below the message box each time, with the agreed wording.

**Acceptance Scenarios**:

1. **Given** the customer opens the app on a new chat, **When** the page loads, **Then** the disclaimer is
   shown directly below the message box.
2. **Given** a conversation with many messages, **When** the customer scrolls the conversation, **Then** the
   disclaimer stays below the message box and does not scroll away.
3. **Given** a narrow (phone-width) screen, **When** the page loads, **Then** the full disclaimer is readable
   below the message box without horizontal scrolling and without covering the message box or Send button.
4. **Given** the customer is waiting for a reply, **When** the waiting indicator shows, **Then** the
   disclaimer is still visible and unchanged.
5. **Given** the customer switches to a past chat from the sidebar, **When** it opens, **Then** the same
   disclaimer is shown.

---

### User Story 2 - Disclaimer is accessible (Priority: P2)

A customer who uses a screen reader, zooms the page or uses a dark colour scheme can read the disclaimer as
easily as anyone else.

**Why this priority**: A disclaimer only works if everyone can perceive it; it is also a common review point
for financial-services UIs.

**Independent Test**: With a screen reader, move from the message box onwards and confirm the disclaimer text
is read; check text contrast in light and dark colour schemes; zoom to 200% and confirm it remains readable.

**Acceptance Scenarios**:

1. **Given** a screen reader user on the message box, **When** they move to the next content, **Then** the
   disclaimer text is read out as plain text (it is not hidden from assistive technology).
2. **Given** light or dark colour scheme, **When** the disclaimer is displayed, **Then** its text meets
   WCAG 2.1 AA contrast for normal text (at least 4.5:1).
3. **Given** the page zoomed to 200%, **When** the disclaimer is displayed, **Then** it wraps and stays fully
   readable.

---

### Edge Cases

- Very narrow screens (320px wide): the disclaimer wraps onto more lines rather than being cut off.
- The message box grows to its maximum height while typing a long message: the disclaimer stays below it
  and remains visible.
- The assistant is unavailable and the backend returns a fallback reply: the disclaimer is unaffected.
- The sidebar is open over the chat on a narrow screen: the disclaimer may be covered by the sidebar overlay,
  as the rest of the chat is; it reappears when the sidebar closes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The UI MUST show a disclaimer directly below the message box on every chat view (new chat and
  reopened past chats), on all screen widths.
- **FR-002**: The disclaimer MUST state that the assistant is an AI whose answers can be wrong, and that
  answers are general information based on demo data and are not financial advice.
- **FR-003**: Default wording (until replaced by approved wording): "PFG Wealth Assistant is an AI and can
  make mistakes. Answers use demo data and are general information, not financial advice." The wording MUST
  be defined in exactly one place so it can be changed without touching layout.
- **FR-004**: The disclaimer MUST stay fixed below the message box while the conversation scrolls, and MUST
  NOT overlap the message box, the Send button or the conversation.
- **FR-005**: The disclaimer MUST be visually secondary to the conversation (smaller, muted text) but MUST meet
  WCAG 2.1 AA contrast in every supported colour scheme.
- **FR-006**: The disclaimer MUST be exposed to assistive technology as plain text and MUST NOT be announced
  again each time a message is sent or received.
- **FR-007**: The disclaimer MUST be static text: no dismiss button, link or interaction.
- **FR-008**: This line MUST replace the current hint line below the message box ("Enter to send ·
  Shift+Enter for a new line. AI answers can be wrong; check important figures."), so there is only one line
  of fine print below the message box.
- **FR-009**: The per-reply disclaimer that the assistant adds to each answer MUST
  [NEEDS CLARIFICATION: keep the per-reply disclaimer, remove it, or show it only on answers that contain
  portfolio figures?]
- **FR-010**: What the assistant returns and how the app talks to it MUST stay unchanged, unless the answer to
  FR-009 requires a change; any such change MUST be described in this spec before it is built.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In 100% of checked views (new chat, reopened chat, waiting for a reply, fallback reply), on a
  wide screen and a 375px-wide screen, the disclaimer is visible below the message box without scrolling.
- **SC-002**: The disclaimer text has a contrast ratio of at least 4.5:1 against its background in every
  supported colour scheme.
- **SC-003**: In a 5-person walkthrough, at least 4 people can say, without prompting, that answers are not
  financial advice after one minute of using the app.
- **SC-004**: Changing the disclaimer wording requires editing one place only, verified by a single text
  change appearing on every view.

## Assumptions

- Builds on the current chat UI from spec 005 (PFG header, navy theme, dark mode, message box with hint line).
- Scope is the web chat UI only; no backend, database or agent changes unless FR-009 requires them.
- The default wording in FR-003 is a placeholder until PFG's compliance team supplies approved text; no legal
  review is part of this feature.
- The keyboard hint ("Enter to send · Shift+Enter for a new line") is dropped because these shortcuts are
  standard in chat apps and the message box placeholder is enough guidance (FR-008).
- No tracking or acknowledgement of the disclaimer (for example, "I agree" clicks) is required.
- Supported colour schemes are the light and dark palettes from spec 005.
