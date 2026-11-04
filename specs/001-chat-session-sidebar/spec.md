# Feature Specification: Chat Session Sidebar

**Feature Branch**: `spekit-integration`

**Created**: 2026-11-04

**Status**: Draft

**Input**: User description: "Show past chat sessions in a sidebar to reopen if required"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See and reopen a past conversation (Priority: P1)

The user has chatted with the assistant before and wants to look back at an earlier
conversation. A sidebar next to the chat lists their past conversations, newest first.
Each entry has a recognisable label and shows when the conversation was last active.
Selecting an entry shows that conversation's full message history in the main chat area.

**Why this priority**: today, reloading the page or leaving loses access to every earlier
conversation, even though the conversations are still stored. This story is the core of
the feature on its own.

**Independent Test**: hold two separate conversations, reload the page, and select the
first conversation in the sidebar. All of its messages appear in their original order.

**Acceptance Scenarios**:

1. **Given** the user has had three earlier conversations, **When** they open the app,
   **Then** the sidebar lists all three, with the most recently active at the top.
2. **Given** the sidebar lists a past conversation, **When** the user selects it, **Then**
   the main area shows every message in it, user and assistant, in the order they were
   sent.
3. **Given** a conversation is open, **When** the user looks at the sidebar, **Then** that
   conversation is visibly marked as the current one.

---

### User Story 2 - Continue a reopened conversation (Priority: P2)

After reopening a past conversation, the user sends a new message. It is added to the end
of that conversation and does not start a new one.

**Why this priority**: reopening is more useful when the user can pick up where they left
off. This story depends on Story 1.

**Independent Test**: reopen a past conversation, send a message, reload the page and
reopen the same conversation. The new message and its reply appear at the end.

**Acceptance Scenarios**:

1. **Given** a reopened past conversation, **When** the user sends a message, **Then** the
   message and the assistant's reply are added to that conversation.
2. **Given** the user has just continued an older conversation, **When** they look at the
   sidebar, **Then** that conversation has moved to the top of the list.

---

### User Story 3 - Start a new conversation (Priority: P3)

While viewing any conversation, the user can start a fresh, empty conversation from the
sidebar.

**Why this priority**: once conversations persist and can be reopened, the user needs a
clear way to begin a new topic. Without this, every message would go into whichever
conversation is open.

**Independent Test**: with a conversation open, choose "New chat" and send a message. A
new entry appears in the sidebar, and the earlier conversation is unchanged.

**Acceptance Scenarios**:

1. **Given** a conversation is open, **When** the user chooses "New chat", **Then** the
   main area is empty and ready for a new message.
2. **Given** the user started a new chat but has not sent anything yet, **When** they look
   at the sidebar, **Then** no empty conversation has been added to the list.
3. **Given** the user sends the first message in a new chat, **When** the reply arrives,
   **Then** the new conversation appears at the top of the sidebar.

---

### Edge Cases

- **No conversations yet**: the sidebar shows a short empty-state message, and the user
  can start chatting right away.
- **Loading or reopening fails** (for example, the service is unreachable): the user sees
  a clear error message and can retry. The chat they currently have open stays usable.
- **Long first message**: the label is shortened to fit on one line and the sidebar
  layout is not affected.
- **Many conversations**: the sidebar scrolls, and the chat input stays reachable.
- **Switching while waiting for a reply**: the reply is saved to the conversation it
  belongs to and never appears in a different conversation.
- **Browser data cleared, or a different browser or device**: the sidebar shows the
  empty state. Conversations from elsewhere are not listed.
- **Narrow screens**: the sidebar can be hidden or collapsed so the chat area keeps
  enough room.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST show a sidebar listing the user's past conversations
  alongside the chat area.
- **FR-002**: The sidebar MUST show only the conversations started in the current
  browser. Conversations started in other browsers or on other devices MUST NOT appear,
  and the user MUST NOT be able to open them from the sidebar.
- **FR-003**: Each sidebar entry MUST show a label taken from the first message the user
  sent in that conversation, and when the conversation was last active.
- **FR-004**: The sidebar MUST order conversations by most recent activity, newest first.
- **FR-005**: Selecting a sidebar entry MUST show that conversation's complete message
  history in chronological order.
- **FR-006**: Messages sent after reopening a conversation MUST be added to that same
  conversation.
- **FR-007**: The user MUST be able to start a new, empty conversation from the sidebar.
- **FR-008**: A conversation MUST appear in the sidebar only after it has at least one
  message.
- **FR-009**: The sidebar MUST visibly mark the conversation that is currently open.
- **FR-010**: The list of past conversations MUST still be there after a page reload.
- **FR-011**: If the conversation list or a conversation's history cannot be loaded, the
  system MUST show an error message and offer a retry, without losing the conversation
  that is currently open.
- **FR-012**: When a past conversation is shown, every message MUST appear as it was
  originally sent and received. This includes replies that came from the fallback
  responder.

### Key Entities

- **Conversation (session)**: one chat thread. Attributes: a stable identifier, when it
  started, when it was last active, and a display label taken from its first user
  message. It contains an ordered list of messages.
- **Message**: one turn in a conversation. Attributes: who sent it (user or assistant),
  its text, and when it was sent. This entity already exists in the system.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can find and reopen a conversation from earlier in the day in under
  10 seconds and in no more than 2 interactions.
- **SC-002**: 100% of messages in a reopened conversation are shown, in their original
  order.
- **SC-003**: With up to 100 past conversations, the sidebar is ready to use within
  2 seconds of opening the app, and a selected conversation appears within 1 second.
- **SC-004**: After a page reload in the same browser, the user can return to any of
  their past conversations from that browser, so no conversation is lost.
- **SC-005**: In a usability check, at least 9 out of 10 people can find the
  "New chat" action and the past-conversations list without guidance.

## Assumptions

- There is no login. "The user" means whoever is using the app in a given browser, and
  the sidebar is scoped to that browser (FR-002).
- If the user clears browser data or switches browser or device, the sidebar starts
  empty. The earlier conversations are still stored but can't be reached from the
  sidebar. This is acceptable for this version.
- This browser-based scoping is a stand-in until user accounts exist. A future feature
  will replace it by scoping conversations to the signed-in user.
- Browser scoping keeps the list tidy but is not a security boundary. Someone who has a
  conversation's identifier could still open it. Access control is out of scope until
  login exists.
- Conversations and their messages are already stored. This feature makes them easy to
  find and reopen and does not change how chatting works.
- Renaming, deleting, searching and pinning conversations are out of scope for this
  version.
- Labels are generated automatically. Users cannot edit them in this version.
- Conversations are kept for as long as the system currently keeps them. This feature
  adds no expiry rules.
- Desktop browsers are the main target. On narrow screens the sidebar only needs to stay
  usable through collapse or hide, not be fully optimised.
