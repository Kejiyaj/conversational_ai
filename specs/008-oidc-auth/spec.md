# Feature Specification: Sign-in Check for the Chat API (OIDC Token Validation)

**Feature Branch**: `008-oidc-auth`

**Created**: 2026-11-06

**Status**: Draft

**Input**: User description: "Back-end sign-in check (OIDC token validation) for the chat API. Why: today the back end trusts the caller and the front end sends no user identity at all, so any caller can read any user's chats. Every request must prove who the user is with a signed token from the identity provider (the client's Okta later; a local stand-in now). Traces to backlog item BL-001 (docs/architecture/architecture-backlog.xlsx). Requirements: every API endpoint except GET /api/health requires "Authorization: Bearer <token>"; missing, malformed, badly signed, expired, wrong-issuer or wrong-audience token returns 401; the user identity comes only from the token's "sub" claim and the client can no longer set the user id any other way; new chats, messages and feedback are stored under that user, and history and session lists return only that user's data; reading another user's chat history or giving feedback on another user's message returns 403; issuer, audience and the public-key (JWKS) URL are configuration only, so switching to Okta needs no code change; a local stand-in identity provider (for example mock-oauth2-server) runs in docker compose for development and issues test tokens; automated tests generate their own keys and tokens and need no running identity provider; the existing demo login page (frontend/apps/web/src/auth/LoginPage.tsx) gets a token from the stand-in identity provider on sign-in, and frontend/packages/core/src/api.ts sends it as "Authorization: Bearer <token>" on every request; coordinate front-end changes with the front-end owner. Out of scope: real Okta login screen, MFA, entitlement check, token refresh and session timeout (BL-055), mobile app sign-in. Acceptance tests: no token 401; bad signature 401; expired 401; wrong issuer 401; wrong audience 401; valid token 200 with data stored under that user; another user's history 403; another user's message feedback 403; health open without a token; web app signs in through the stand-in and chats successfully."

## Clarifications

### Session 2026-11-06

- Q: Should requests for another user's chat history, messages or feedback be refused with 403 (not allowed) or 404 (not found)? → A: 404, so that the response does not reveal that the chat exists. All other defaults in the first draft are accepted as written.
- Q: Since another user's chat now answers 404, what should history for a chat that doesn't exist return, given that it returns 200 with an empty list today? → A: 404 as well, with the same response. Otherwise the difference between 404 and 200 would still reveal that another user's chat exists. This follows from the answer above.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Refuse callers who can't prove who they are (Priority: P1)

Today anyone who can reach the back end can read or write any conversation. After this
change, every request to the chat API, except the health check, must carry a signed token
from the identity provider. The back end checks that the token is genuine, unexpired, issued
by the expected identity provider and meant for this API. If any check fails, it refuses the
request and does nothing else.

**Why this priority**: this closes the gap that lets any caller read any user's chats. It is
the minimum that makes the API safe to expose, and BL-001's done criteria call for it
directly ("calls without a valid token are rejected").

**Independent Test**: call each protected endpoint with no token, with a token signed by an
unknown key, with an expired token, with a token from a different issuer, and with a token
for a different audience. Every call is refused as unauthenticated and nothing is stored.
Call the health check with no token, and it answers normally.

**Acceptance Scenarios**:

1. **Given** a request to any protected endpoint, **When** it carries no `Authorization`
   header, **Then** the system refuses it as unauthenticated (401) and stores nothing.
2. **Given** a request whose `Authorization` header is not of the form `Bearer <token>`, or
   whose token is not a well-formed signed token, **When** it arrives, **Then** the system
   refuses it as unauthenticated (401).
3. **Given** a token whose signature does not verify against the identity provider's
   published keys, **When** it is presented, **Then** the system refuses it (401).
4. **Given** a token that has expired, **When** it is presented, **Then** the system refuses
   it (401).
5. **Given** a token issued by a different issuer than the configured one, **When** it is
   presented, **Then** the system refuses it (401).
6. **Given** a token issued for a different audience than the configured one, **When** it is
   presented, **Then** the system refuses it (401).
7. **Given** a request to the health check, **When** it carries no token, **Then** the
   system answers normally (200).
8. **Given** any refused request, **When** the refusal is returned, **Then** the response
   uses the project's standard error shape, `{"detail": "<message>"}`, and tells the caller
   that a bearer token is required.

---

### User Story 2 - Each user sees and stores only their own conversations (Priority: P1)

Once the caller is known, every conversation belongs to the user who started it. New chats,
their messages and any feedback are stored under that user. Chat history and the session
list return only that user's conversations. A user who asks for someone else's history, adds
a message to someone else's chat, or rates someone else's answer is told it was not found,
exactly as if the chat did not exist, so the response gives away nothing about other users'
chats.

**Why this priority**: proving identity is not enough on its own. Without ownership, a
signed-in user could still read every other user's chats. This story is what actually
delivers privacy, and it is equal in priority to User Story 1.

**Independent Test**: with a valid token for user A, start a chat and send a message. Check
that the conversation is recorded as A's and that A can read its history. With a valid token
for user B, ask for A's history, send a message into A's chat, and rate A's answer. Each is
answered as not found (404), with the same response as for a chat or message that doesn't
exist, and A's data is unchanged. B's session list does not contain A's chat, even when B
asks for it by id.

**Acceptance Scenarios**:

1. **Given** a valid token for user A, **When** A starts a new chat, **Then** the reply
   succeeds (200) and the conversation, both messages and any later feedback are stored
   under A.
2. **Given** a chat that belongs to A, **When** A asks for its history with a valid token,
   **Then** the full history is returned, unchanged from today's response.
3. **Given** a chat that belongs to A, **When** user B asks for its history, **Then** the
   system answers not found (404), with the same response as for a chat that doesn't exist,
   and returns none of the messages.
4. **Given** a chat that belongs to A, **When** user B sends a message into it, **Then** the
   system answers not found (404), the agent is not called, and nothing is stored.
5. **Given** an assistant answer in A's chat, **When** user B submits feedback for it,
   **Then** the system answers not found (404), with the same response as for a message
   that doesn't exist, and A's existing feedback, if any, is unchanged.
6. **Given** a user message in A's chat, **When** user B submits feedback for it, **Then**
   the system answers not found (404), not the "not an assistant message" refusal that A
   would get, so B learns nothing about the message.
7. **Given** a chat id that doesn't exist, **When** A asks for its history, **Then** the
   system answers not found (404), with the same response as for another user's chat, and
   creates nothing.
8. **Given** A has some chats and B has others, **When** B asks for the session list,
   including the ids of A's chats, **Then** only B's chats are returned. A's chats are
   silently left out, the same way unknown ids are left out today.
9. **Given** a request body or query that names a user (for example a `user_id` field),
   **When** it arrives with a valid token, **Then** the system ignores that value and uses
   only the user named in the token.

---

### User Story 3 - Sign in to the web app and chat (Priority: P1)

The web app's existing sign-in page now gets a real token. When the user signs in, the page
asks the local stand-in identity provider for a token for that username, and the web app
sends it with every request. The user then chats exactly as before. If the token stops
working, for example because it has expired, the web app takes the user back to the sign-in
page with a short explanation instead of showing broken chats.

**Why this priority**: once User Stories 1 and 2 ship, the web app stops working without
this. It has to ship in the same change, so that the product stays usable and demoable.

**Independent Test**: start the stand-in identity provider and the back end with docker
compose, open the web app, sign in as `jane`, and send a message. The reply arrives and the
conversation is stored under `jane`. Sign out, sign in as `vinod`, and confirm that `jane`'s
chats are not listed.

**Acceptance Scenarios**:

1. **Given** the stand-in identity provider is running, **When** the user signs in on the
   existing sign-in page, **Then** the web app obtains a token whose subject is that
   username, and the user reaches the chat screen.
2. **Given** the user is signed in, **When** the web app calls any API endpoint, **Then** it
   sends the token as `Authorization: Bearer <token>`.
3. **Given** the user is signed in, **When** they send a message, open a past chat or rate
   an answer, **Then** it works as it does today.
4. **Given** the stand-in identity provider can't be reached or refuses to issue a token,
   **When** the user tries to sign in, **Then** the sign-in page shows a clear error and
   the user stays on the sign-in page.
5. **Given** the user is signed in, **When** any API call is refused as unauthenticated
   (401), **Then** the web app signs the user out and shows the sign-in page with a message
   that they need to sign in again.
6. **Given** the user signs out, **When** sign-out completes, **Then** the token is
   discarded and no later request carries it.
7. **Given** the sign-in page, **When** it is shown, **Then** its demo notice no longer says
   that nothing is sent to a server. It says that sign-in uses a local test identity provider
   and that any username works.

---

### User Story 4 - Switch to the client's identity provider by configuration only (Priority: P2)

The identity provider's issuer, the audience this API accepts, and the address of the
provider's public keys are settings, not code. Developers point them at the local stand-in
now. Later, operations point them at the client's Okta tenant without changing or
redeploying code.

**Why this priority**: the back end is built against a stand-in only because the Okta tenant
is not available yet (BL-001's open item). Keeping everything provider-specific in
configuration makes the later switch to Okta a configuration change only. It matters less
than the protection itself, because the stand-in already delivers that.

**Independent Test**: run the automated tests twice with two different sets of issuer,
audience and key-address settings, and with tokens to match each. Both runs pass with no code
change. A token that matches the first set is refused under the second.

**Acceptance Scenarios**:

1. **Given** the issuer, audience and public-key address settings, **When** they are changed
   to another identity provider's values, **Then** the back end accepts tokens from that
   provider and refuses tokens from the old one, with no code change.
2. **Given** any of the three settings is missing or empty, **When** the back end starts,
   **Then** it refuses to start and names the missing setting. It never silently accepts
   requests without checking them.
3. **Given** the identity provider replaces its signing key and publishes the new one,
   **When** a token signed with the new key is presented, **Then** it is accepted without
   restarting the back end.

---

### User Story 5 - Develop and test without a real identity provider (Priority: P2)

Developers run a local stand-in identity provider alongside the database and back end in
docker compose, and can get a test token for any username to try the API by hand. The
automated tests create their own signing keys and tokens and need no identity provider, no
network and no Docker.

**Why this priority**: the project requires that tests run with nothing but the test runner
(Principle IV), and every contributor has to be able to run the system before Okta access
exists. It supports the other stories rather than adding user value of its own.

**Independent Test**: on a machine with no network access and nothing running, run the
back-end test suite, and it passes, including every token and ownership case. Separately, run
docker compose, fetch a test token from the stand-in as documented in `README.md`, and call
`POST /api/chat` with it successfully.

**Acceptance Scenarios**:

1. **Given** docker compose is started, **When** it is up, **Then** a stand-in identity
   provider is running and the back end is configured to trust it.
2. **Given** the stand-in is running, **When** a developer follows the `README.md`
   instructions to get a token for a chosen username, **Then** they receive a token that the
   back end accepts, with that username as the subject.
3. **Given** a machine with no network and no running services, **When** the back-end test
   suite runs, **Then** every test passes, including every case in this spec.

---

### Edge Cases

- **Health check with a bad token**: a health check that carries a missing, invalid or
  expired token still answers normally. Health never looks at the token.
- **Scheme spelling**: the scheme word is matched without regard to case, so `bearer` and
  `BEARER` work as well as `Bearer`. A header with the scheme and no token, a different
  scheme (for example `Basic`), or extra parts is refused (401).
- **Token sent another way**: a token in the query string, a cookie or the request body is
  not looked at. Without the header, the request is refused (401).
- **Unsigned token, or one using a shared-secret signature**: refused (401), even if its
  claims look right. Only tokens signed with the identity provider's published public keys
  are accepted.
- **Token signed with a key the provider has not published**: refused (401). It is treated
  the same as a bad signature.
- **Token not yet valid** (its "not before" time is in the future): refused (401).
- **Small clock differences**: a token is still accepted if it expired no more than 60
  seconds ago, so that small clock differences between machines don't cause refusals. A token
  that expired more than 60 seconds ago is refused (401).
- **Token with no subject, or an empty subject**: refused (401), because there is no user to
  act for.
- **Token with several audiences**: accepted if the configured audience is one of them.
- **Identity provider's key address unreachable**: if the back end has no usable keys and
  can't fetch them, it does not blame the caller. It answers that the service is temporarily
  unavailable (503) with the standard error shape, and logs a warning that states the reason.
  Keys it already holds keep working while the address is unreachable.
- **Caller names a user**: any user id in the body, the query or another header is ignored.
  Only the token's subject counts.
- **Two users and one session id**: if two users send the first message of a chat with the
  same session id at nearly the same moment, the chat belongs to whichever is stored first,
  and the other gets not found (404). Neither gets a reply stored in the other's chat.
- **Chats created before this change**: they belong to no user. To everyone, they look as if
  they don't exist: reading them, adding to them or rating their answers gets not found
  (404), and they never appear in a session list. They stay in the database untouched.
- **History of a chat that doesn't exist**: now answers not found (404) instead of today's
  empty history, so it can't be told apart from another user's chat. Nothing is created.
- **Feedback for a message that doesn't exist**: still reported as not found (404), as today,
  and with the same response as for another user's message.
- **Same response for "not yours" and "doesn't exist"**: for each endpoint, the status code
  and the `detail` message for another user's chat or message are exactly the same as for
  one that doesn't exist. The log records which case it was.
- **A new chat id that is already taken by another user**: sending a first message with that
  id gets not found (404), while a free id would start a new chat. This tells the caller only
  that the id can't be used. Chat ids are random and hard to guess, so this is accepted.
- **Same browser, different users**: the web app remembers chat ids per browser, not per
  user. When a second user signs in on the same browser, the back end leaves the first
  user's chats out of the list, so the second user never sees them.
- **Logs**: a refused request is logged with the reason (for example "expired" or "wrong
  audience"), but the token itself is never written to the logs. The response to the caller
  does not say which check failed.
- **Pages outside the API** (for example the back end's built-in API documentation pages):
  not affected by this feature.

## Requirements *(mandatory)*

### Functional Requirements

**Checking the token**

- **FR-001**: Every API endpoint except `GET /api/health` MUST require an `Authorization`
  header of the form `Bearer <token>`. Today that is `POST /api/chat`,
  `GET /api/chat/{session_id}/history`, `GET /api/sessions` and
  `POST /api/messages/{message_id}/feedback`, and it MUST cover any API endpoint added
  later unless a spec exempts it.
- **FR-002**: `GET /api/health` MUST answer without a token and MUST NOT look at the
  `Authorization` header.
- **FR-003**: The system MUST refuse a request with 401 when the header is missing, is not
  of the form `Bearer <token>`, or carries a token that is malformed, whose signature does
  not verify against the identity provider's published keys, that is unsigned or signed with
  a shared secret, that has expired (beyond the tolerance in FR-004), that is not yet valid,
  whose issuer is not the configured issuer, whose audience does not include the configured
  audience, or whose subject is missing or empty.
- **FR-004**: The expiry and "not before" checks MUST allow a clock tolerance of no more
  than 60 seconds.
- **FR-005**: A 401 response MUST use the standard error shape `{"detail": "<message>"}`,
  MUST signal that a bearer token is required, and MUST NOT say which check failed.
- **FR-006**: A refused request MUST have no side effects. It MUST NOT call the agent and
  MUST NOT create or change any conversation, message or feedback.
- **FR-007**: Each refusal MUST be logged as a warning with the reason. The token MUST NOT
  be written to any log.
- **FR-008**: If the system holds no usable keys and can't fetch them from the configured
  address, it MUST answer 503 with the standard error shape and log a warning with the
  reason, instead of answering 401.
- **FR-009**: The system MUST accept tokens signed with a key the identity provider has newly
  published, without a restart.

**Who the user is**

- **FR-010**: The user's identity MUST come only from the subject (`sub`) of a valid token.
- **FR-011**: The system MUST NOT accept a user identity from anywhere else: not from the
  request body, the query string, other headers or cookies. Any such value MUST be ignored.

**Whose data it is**

- **FR-012**: A new chat MUST be stored as belonging to the user who sent its first message.
  Its messages, and feedback on its answers, belong to that user too.
- **FR-013**: `POST /api/chat` into an existing chat that belongs to another user, or to no
  user, MUST be answered with 404. The agent MUST NOT be called and nothing is stored.
- **FR-014**: `GET /api/chat/{session_id}/history` for a chat that belongs to another user,
  belongs to no user, or does not exist MUST be answered with 404 and return no messages.
  Today a chat that does not exist returns an empty history with 200, and this changes to
  404. For the owner, the response MUST be unchanged from today.
- **FR-015**: `GET /api/sessions` MUST return only chats that belong to the caller. Requested
  ids of chats that belong to another user, or to no user, MUST be left out silently, the
  same way unknown ids are left out today.
- **FR-016**: `POST /api/messages/{message_id}/feedback` for a message in a chat that belongs
  to another user, or to no user, MUST be answered with 404 and MUST NOT change any feedback.
  The ownership check MUST come before the spec 002 checks that reveal something about the
  message, so that another user's user message also gets 404 and not the "not an assistant
  message" refusal. For the owner, all feedback rules from spec 002 stay as they are.
- **FR-017**: For each endpoint, the 404 for another user's chat or message MUST be exactly
  the same, in status code and `{"detail": "<message>"}` body, as the 404 for one that does
  not exist. The API MUST NOT use 403 to refuse access to another user's data.
- **FR-018**: Chats stored before this feature have no owner. They MUST stay in the database
  unchanged and MUST be treated as belonging to no user (FR-013 to FR-016).
- **FR-019**: Recording the owner MUST be added through the project's normal database
  migration process, and the migration MUST apply to a database that already holds chats.

**Configuration**

- **FR-020**: The accepted issuer, the accepted audience and the address of the identity
  provider's public keys MUST be set only through configuration. Pointing the back end at a
  different OIDC identity provider, such as the client's Okta tenant, MUST need no code
  change.
- **FR-021**: If any of the three settings is missing or empty, the back end MUST refuse to
  start and MUST name the missing setting. There MUST be no setting or mode that turns the
  token check off.
- **FR-022**: `.env.example` MUST list the three settings, with values for the local
  stand-in.

**Local stand-in and tests**

- **FR-023**: Docker compose MUST run a local stand-in identity provider that issues signed
  tokens for any username, and MUST configure the back end to trust it.
- **FR-024**: `README.md` MUST explain how to get a test token from the stand-in and use it
  to call the API by hand.
- **FR-025**: The automated back-end tests MUST create their own signing keys and tokens and
  MUST NOT need a running identity provider, network access or Docker.
- **FR-026**: Each case in this spec's acceptance scenarios and edge cases MUST have at least
  one automated test.

**Web app**

- **FR-027**: On sign-in, the existing web sign-in page MUST get a token from the stand-in
  identity provider whose subject is the entered username. The real Okta sign-in screen is
  out of scope.
- **FR-028**: The shared API client MUST send the current token as
  `Authorization: Bearer <token>` on every request it makes, and MUST NOT send one when no
  user is signed in.
- **FR-029**: If the stand-in can't be reached or refuses to issue a token, the sign-in page
  MUST show a clear error and the user MUST stay on the sign-in page.
- **FR-030**: When any API call is refused with 401, the web app MUST sign the user out and
  show the sign-in page with a message asking them to sign in again.
- **FR-031**: Signing out MUST discard the token. The password MUST NOT be stored in the
  browser.
- **FR-032**: The sign-in page's demo notice MUST be updated to say that sign-in uses a local
  test identity provider and any username works.

**Contracts and documentation**

- **FR-033**: Request and response bodies of every endpoint MUST stay unchanged. The changes
  to the contract are the required `Authorization` header, the new 401 and 503 responses,
  404 for other users' chats and messages, 404 instead of an empty history for a chat that
  does not exist, and the session list leaving out other users' chats.
- **FR-034**: The contract between the back end and the agent MUST NOT change. The agent
  receives no user identity in this feature.
- **FR-035**: `README.md` MUST describe the required header, the new responses, the three
  settings and how to run with the stand-in, in the same change that adds them.

### Key Entities

- **User identity**: the person the request is made for, as named by the subject of a valid
  token. It is not stored as a record of its own in this feature. It is recorded only as the
  owner of chats.
- **Chat session**: an existing entity. It gains an owner: the user who sent its first
  message. Chats created before this feature have no owner.
- **Message**: an existing entity. It belongs to the owner of its chat.
- **Feedback**: an existing entity. It belongs to the owner of the chat its message is in.
- **Identity provider settings**: the accepted issuer, the accepted audience and the address
  of the provider's public keys. They are configuration, not stored data.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of requests to protected endpoints that carry no valid token are refused
  as unauthenticated, across every failure kind in FR-003, and none of them calls the agent
  or stores anything.
- **SC-002**: 0 messages, history entries or session summaries belonging to one user are
  ever returned to another user, and 0 feedback records are ever changed by another user.
- **SC-003**: 100% of chats, messages and feedback created after this change are recorded
  under the user named in the token.
- **SC-004**: The health check answers without a token in 100% of attempts.
- **SC-005**: Pointing the back end at a different identity provider takes only settings
  changes. No code is changed, as shown by the automated tests passing under two different
  sets of settings.
- **SC-006**: The full back-end test suite passes on a machine with no network access and no
  running services.
- **SC-007**: A developer can go from a fresh checkout to a signed-in chat in the web app,
  using docker compose and the stand-in, by following `README.md` alone, in under 10
  minutes.
- **SC-008**: The sign-in check adds no delay that users notice. Chat replies and history
  load in the same time as before, within normal variation.
- **SC-009**: Existing behavior is unchanged for the owner. Every existing back-end and web
  test passes after being updated only to send a valid token or to sign in through the
  stand-in. The one exception is the test for the history of a chat that doesn't exist,
  which now expects 404 instead of an empty history.

## Assumptions

- **Traceability**: the feature implements the token-check part of BL-001 (Customer
  identity: Okta SSO and MFA) in `docs/architecture/architecture-backlog.xlsx`. BL-001's open
  item says it "ships first against a stub" until the client's Okta tenant is available, and
  this feature is that stage. See Source Traceability below.
- **Front-end owner**: Vinod owns `frontend/` (per `README.md`). The web changes in User
  Story 3 need his review, and because the API contract changes, both the front-end and
  back-end owners review the PR.
- **Affected consumers** (Principle I): the web app, which is updated in this feature; the
  back-end tests, which are updated to send tokens; and anyone calling the API by hand, who
  now needs a token from the stand-in. The mobile app does not call the API yet (it uses only
  a text helper from the shared package), so nothing breaks there. Mobile sign-in is out of
  scope. The agent is not affected.
- **One identity provider at a time**: the back end trusts a single issuer. Users are told
  apart by the token's subject alone. Chats created under the stand-in will not carry over to
  Okta users, because the subjects will differ. That is acceptable for development data.
- **Okta compatibility**: the client's Okta tenant issues standard OIDC access tokens that
  are signed with published public keys and carry issuer, audience, expiry and subject
  claims. The issuer and the key address are separate settings, because the address the back
  end uses to fetch keys inside docker compose may differ from the issuer name in the token.
- **Token kind**: the web app sends an access token meant for this API, identified by the
  configured audience. Checking scopes or other claims is out of scope.
- **Ownership is per chat**: the owner is set when a chat is first stored and never changes.
  Messages and feedback are owned through their chat. Sharing a chat with another user is
  out of scope.
- **404 for someone else's chat**: another user's chat or message is answered as not found,
  so the response does not reveal that it exists (see Clarifications). The web app opens
  history only for chats in its list or right after a message was stored, so the change from
  an empty history to 404 for a chat that doesn't exist does not affect it. The README and
  the existing back-end test for that case are updated.
- **Chats with no owner**: chats stored before this feature are treated as nobody's rather
  than given to a guessed user. They exist only in development and demo databases.
- **The web app's session**: the web app keeps the token for as long as the user stays signed
  in, including across page reloads, until it expires or the user signs out. Where it is kept
  in the browser is decided in the plan. With no token refresh (BL-055), an expired token
  sends the user back to the sign-in page.
- **Stand-in passwords**: the stand-in accepts any username and does not check passwords. The
  sign-in page still asks for a password, so that it looks like a real sign-in.
- **Local ports**: the stand-in runs on a port that doesn't clash with local services already
  in use. In particular, the local agent uses 8080.
- **Choice of stand-in**: mock-oauth2-server is the suggested stand-in. The plan may choose
  another, as long as it issues standard signed tokens and publishes its keys.
- **Out of scope**: the real Okta sign-in screen, MFA, the entitlement check, token refresh
  and session timeout (BL-055), mobile app sign-in, passing the user's token or identity to
  the agent runtime (BL-008), and storing user profiles.
- The exact library, key caching, error wording and schema details are decided in the plan.

## Source Traceability

Source: **BL-001** (Customer identity: Okta SSO and MFA) in
`docs/architecture/architecture-backlog.xlsx`. Status: Covered, Partial, Not covered, or
Deferred (planned under another backlog item).

| Source | What it asks for | Status | Where |
|--------|------------------|--------|-------|
| BL-001 description | Customer signs in with Okta | Partial. Signs in through a local stand-in. Okta is a configuration change later | US3, US4, FR-020, FR-027 |
| BL-001 description | The app holds the token and sends it with calls | Covered for the web app | FR-028 |
| BL-001 description | The agent runtime validates the token before any agent runs | Deferred to BL-008. The back end validates it before calling the agent | FR-006, FR-034 |
| BL-001 done criteria | Sign-in with Okta SSO and MFA on web and mobile | Not covered. Okta screen, MFA and mobile are out of scope | Assumptions |
| BL-001 done criteria | Calls without a valid token are rejected | Covered | US1, FR-001 to FR-009 |
| BL-001 done criteria | Not entitled gives a plain message with a next step | Not covered. Entitlement is out of scope | Assumptions |
| BL-001 done criteria | Entitlement service failure falls back to education only | Not covered. Entitlement is out of scope | Assumptions |
| BL-001 open item | Ships first against a stub until Okta tenant access exists | Covered | US4, US5, FR-023 |

Added by this spec, and not asked for by BL-001: per-user ownership of chats, messages and
feedback, with 404 for other users' data (User Story 2); the tests' own keys and tokens; the 503
response when the identity provider's keys can't be fetched; the 60-second clock tolerance;
and sending the user back to sign-in when a token is refused.
