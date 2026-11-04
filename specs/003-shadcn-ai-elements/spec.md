# Feature Specification: Chat UI on shadcn AI Elements with Principal Theme

**Feature Branch**: `003-shadcn-ai-elements`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Use shadcn as the UI kit, and for chat specifically use shadcn AI Elements (https://ui.shadcn.com/docs/ai-elements), Radix UI variant. Then apply the Principal theme (taken from principal.com) to it."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Same chat, rebuilt on the new component kit (Priority: P1)

A customer uses the chat exactly as they do today: they start a new chat, send messages, see replies,
open a past chat from the sidebar, and use the "Chats" toggle on a narrow screen. Everything they
could do before still works the same way. The chat now also behaves like a modern chat app: the
thread stays pinned to the newest message, a "scroll to latest" control appears when they scroll
up, and the message box grows for longer messages.

**Why this priority**: The team needs a consistent, accessible component base before building the
interactive conversational cards (Nov 11 milestone). Rebuilding with no lost behavior is the
foundation for everything after it.

**Independent Test**: Run the existing chat flows (new chat, send, reply, open past chat, retry
after an error, narrow-screen toggle) and confirm each one behaves as before. The existing
frontend test suite passes.

**Acceptance Scenarios**:

1. **Given** an empty new chat, **When** the customer types a message and sends it, **Then** their message appears on the right, a waiting indicator shows, and the reply appears on the left.
2. **Given** a reply is pending, **When** the customer looks at the send control, **Then** it is disabled until the reply arrives.
3. **Given** past chats exist, **When** the customer selects one in the sidebar, **Then** its full history is shown and it is marked as the current chat.
4. **Given** loading past chats fails, **When** the sidebar shows the error, **Then** a Retry action is available and retries the load.
5. **Given** a long conversation, **When** a new reply arrives while the customer is at the bottom, **Then** the view stays on the newest message.
6. **Given** the customer has scrolled up, **When** they want to return, **Then** a "scroll to latest" control is shown and takes them to the newest message.
7. **Given** the message box has focus, **When** the customer presses Enter, **Then** the message is sent; **When** they press Shift+Enter, **Then** a new line is added instead.
8. **Given** a narrow screen, **When** the customer taps "Chats", **Then** the sidebar opens; tapping outside or choosing a chat closes it.

---

### User Story 2 - Principal look and feel (Priority: P2)

A customer opening the chat sees an experience that feels like part of principal.com: Principal
blue for primary actions, pill-shaped buttons and message box, rounded cards, Principal's text
colors and type scale, and its focus styling.

**Why this priority**: The POC is shown to Principal stakeholders; matching their brand makes the
demo credible. It depends on Story 1 being in place, since the theme is applied through the new
component base.

**Independent Test**: Open the chat next to principal.com and compare primary button color, button
and input shape, card radius, body text color, and focus outline. Each matches the values recorded
in the Principal theme reference.

**Acceptance Scenarios**:

1. **Given** the chat is open, **When** the customer looks at primary actions (Send, New chat), **Then** they use Principal interactive blue (#005fb8), darken on hover, and are pill-shaped.
2. **Given** the chat is open, **When** the customer reads messages, **Then** body text uses Principal's default text color (#2f2f2f), not pure black, at a comfortable size and line height.
3. **Given** a keyboard user tabs through the page, **When** a control receives focus, **Then** a clearly visible Principal focus ring is shown.
4. **Given** the customer's own messages and the assistant's replies, **When** both are on screen, **Then** they are visually distinct using Principal brand colors.

---

### Edge Cases

- A very long message with no spaces (for example, a pasted URL) wraps inside its bubble and does not widen the page.
- Sending is blocked for empty or whitespace-only input, as it is today.
- If a reply fails, the customer sees the existing "Something went wrong." reply and can keep chatting.
- Switching chats while a reply is pending never shows the reply in the wrong chat (current behavior from spec 001 is kept).
- Principal's licensed font is not available, so the fallback font is used without layout breaking.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The chat thread, message turns, message box, and sidebar MUST be built from the shared component kit chosen for the project, with no hand-built equivalents left alongside them.
- **FR-002**: All behavior defined in spec 001 (session sidebar) and the current chat flow MUST be preserved: new chat, send, reply, waiting indicator, disabled send while pending, open past chat, error with Retry, empty state, narrow-screen toggle and backdrop.
- **FR-003**: The thread MUST stay pinned to the newest message while the customer is at the bottom, and MUST show a "scroll to latest" control when they are not.
- **FR-004**: The message box MUST send on Enter, add a new line on Shift+Enter, and grow with its content up to a maximum height.
- **FR-005**: The customer's messages and assistant replies MUST be visually distinguished by alignment and style.
- **FR-006**: The UI MUST use the Principal theme values for color, button and input shape, card radius, text color, type scale, and focus ring, as recorded in the Principal theme reference.
- **FR-007**: The theme MUST be defined in one place, so later features (conversational cards) inherit it without restyling.
- **FR-008**: All interactive controls MUST be reachable and usable by keyboard, with visible focus, and announced correctly by screen readers.
- **FR-009**: The public repository MUST NOT contain Principal's stylesheets, font files, or logo; only the color, size, and shape values needed for the theme. *(Amended 2026-11-04 by spec 005: a placeholder "PFG" text wordmark drawn from theme variables is allowed; it is not Principal's logo artwork.)*
- **FR-010**: The frontend ↔ backend contract MUST NOT change.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the existing frontend tests pass after the rebuild, without weakening what they check.
- **SC-002**: Each chat flow in User Story 1 can be completed by a tester with no difference in steps compared with the current UI.
- **SC-003**: Primary action color, button radius, card radius, body text color, and focus ring color match the Principal reference values exactly.
- **SC-004**: Every interactive control can be reached and operated with the keyboard alone.
- **SC-005**: A developer can change the primary brand color in one place and see it applied across the whole chat UI.

## Assumptions

- The component kit is shadcn with AI Elements, using the Radix UI variant; this was chosen by the frontend owner. It applies to the chat UI only. The backend and agent are unaffected.
- The Principal theme reference lives outside the repo (`../principal-theme/`); only the needed values are copied in.
- ~~No Principal logo or product name is shown; the title stays "Conversational AI".~~ Superseded 2026-11-04 by spec 005 (product owner decision): the header shows a placeholder "PFG" wordmark and the title "PFG Wealth Assistant". Swap in an approved brand asset when one exists.
- Principal's font (FS Elliot) is licensed; the theme uses its own documented fallback (Arial).
- ~~Light mode only for the POC; dark mode is out of scope.~~ Superseded 2026-11-04 by spec 005: a dark palette follows the system setting, and the brand family moved from Principal blue to navy (product owner decision).
- Interactive conversational cards (Nov 11 milestone), answer feedback controls (spec 002 UI), and document upload are out of scope; this spec prepares the base they will use.
- Web only; React Native/mobile app is out of scope for this spec.
