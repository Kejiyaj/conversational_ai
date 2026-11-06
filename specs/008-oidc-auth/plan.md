# Implementation Plan: Sign-in Check for the Chat API (OIDC Token Validation)

**Branch**: `008-oidc-auth` | **Date**: 2026-11-06 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-oidc-auth/spec.md`

## Summary

Every API call except the health check must carry a signed token from the identity provider.
The backend checks the token, takes the user from its `sub`, and only lets that user see and
add to their own chats.

- **Token check (backend):** a new module, `app/auth.py`, uses PyJWT. A `current_user` FastAPI
  dependency reads `Authorization: Bearer <token>`. It verifies the signature against the
  identity provider's published keys (cached, with refresh on rotation and a last-good
  fallback during outages), and checks `iss`, `aud`, `exp`, `nbf` and `sub` with 60 seconds of
  clock tolerance. Failures return 401. If no keys can be fetched at all, it returns 503. The
  issuer, audience and key address come from three environment variables, and the backend
  won't start without them.
- **Ownership (backend):** migration `0003` adds a nullable `sessions.user_id`. New sessions
  record the caller. History, chat and feedback answer 404 for another user's or nobody's data,
  and for history of a chat that doesn't exist. The 404 is the same in every case, so it can't
  be used to tell whether a chat exists. The session list leaves out other users' sessions.
- **Stand-in (dev):** mock-oauth2-server 6.1.4 runs in docker compose on port 8090, and issues
  tokens with `sub` set to the username and `aud` set to `convai-api`.
- **Web app (Vinod to review):** the existing sign-in page fetches a token from the stand-in.
  `@convai/core`'s `configureApi` gains optional `getToken` and `onUnauthorized` settings, so
  every API call sends the token and a 401 returns the user to sign-in.
- **Tests:** they generate their own RSA keys and tokens, and stub the key fetch. No identity
  provider, network or Docker is needed.

## Technical Context

**Language/Version**: Python 3.12 (backend). TypeScript with React 19 and Vite (web app and the
`@convai/core` package).

**Primary Dependencies**: FastAPI 0.162, SQLAlchemy 2.x (sync), psycopg 3, Alembic, httpx, as
today. The one new dependency is **`pyjwt[crypto]>=2.10,<3`**, which adds `cryptography`
(research R1). No new front-end dependency. Dev only: the `ghcr.io/navikt/mock-oauth2-server:6.1.4`
image.

**Storage**: PostgreSQL. One new nullable column, `sessions.user_id`, through migration `0003`.
`messages` and `feedback` are unchanged.

**Testing**: pytest with in-memory SQLite, test-generated RSA keys and a stubbed key fetch
(R11). Vitest with mocked `fetch` for the web app (contract web-sign-in.md, section 5).

**Target Platform**: the backend runs in Docker (Linux) or locally on macOS. The web app runs in
desktop and mobile browsers.

**Project Type**: web application (FastAPI backend, React web app, shared TypeScript packages).

**Performance Goals**: no noticeable added latency (SC-008). The signature check is local and
takes well under a millisecond. The key set is fetched at most once per 5 minutes, plus at
most once per 30 seconds for an unknown key id. One primary-key lookup is added per request
for ownership.

**Constraints**:

- every protected endpoint must answer 401, 404 or 503 with `{"detail": ...}`, before any side
  effect
- the token is never logged
- there is no setting that turns the check off
- the migration must work on Postgres 14 and 17
- the tests must run offline
- the mobile app's `configureApi({ baseUrl })` call must keep compiling.

**Scale/Scope**: POC. One new backend module, four handlers changed, one migration, one compose
service, and five web or core files changed.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How the design complies |
|-----------|--------|-------------------------|
| I. Contract-First Interfaces | ✅ Pass, with a breaking change made the permitted way | The changes are written into [contracts/auth-api.md](./contracts/auth-api.md) and [contracts/web-sign-in.md](./contracts/web-sign-in.md) before any code: the required header, the new 401, 503 and 404 cases, history of an unknown chat answering 404 instead of an empty list, and the filtered session list. They break unauthenticated callers on purpose, which Principle I allows when the spec names every consumer and they are updated together (R17). The consumers are the web app (updated in this PR, reviewed by Vinod), the back-end tests (updated), and people calling by hand (the README explains how to get a token). The mobile app makes no API calls, and the agent contract is unchanged. No request or response field is renamed, removed or retyped. The `configureApi` options are additive and optional. The README contract section is updated in the same PR, and both the frontend and backend owners review. |
| II. Graceful Agent Degradation | ✅ Pass | The agent path is unchanged. Auth and ownership refusals happen before the agent is called, so they aren't agent failures, and the mock fallback, its logging and `source` are untouched. The 503 belongs to the identity provider, not the agent, and is never turned into a mock reply, because answering without knowing the user would break FR-006. |
| III. Persistence Through Alembic Only | ✅ Pass | The column comes from migration `0003` only. It is nullable, so no backfill is needed (data-model.md). A session's owner is written in the same transaction as its first messages (`_persist`). The read endpoints (history, sessions) still create nothing, and history of an unknown chat now answers 404 instead of an empty list, still with no side effect. |
| IV. Tests Run Without External Services | ✅ Pass | Keys and tokens are generated in `conftest.py`, and the key fetch is stubbed by overriding `get_verifier` (R11). Every test point in both contracts gets a test. A guard test makes sure every current and future `/api/*` route except health requires the token. Existing tests keep passing because the default `client` sends alice's token, and only the unknown-history test changes its expectation (SC-009). |
| V. POC Simplicity | ✅ Pass, with justified additions | Three additions, each justified in Complexity Tracking below: the `pyjwt[crypto]` dependency, the dev-only `oidc` compose service, and a one-method subclass of `PyJWKClient`. Auth isn't speculative here, because this spec asks for it (Principle V names auth as something that needs a spec). There is no user table, no roles and no middleware. It is one dependency function and one column. |

Also checked against the technology constraints:

- **Sync SQLAlchemy and plain FastAPI handlers:** yes.
- **The web app calls the backend only through `/api`:** still true. The token request goes to
  the identity provider, not the backend, and its address is a setting (`VITE_OIDC_TOKEN_URL`).
- **Settings come from environment variables, and `.env.example` lists every one:** the file
  doesn't exist today, so this PR creates it with `DATABASE_URL`, `AGENT_URL`, the three
  `OIDC_*` variables and `VITE_OIDC_TOKEN_URL`.
- **No secrets committed:** the stand-in has none, and Okta values are public identifiers.
- **Invalid client input returns 400 `{"detail"}`:** unchanged. The new 401, 404 and 503
  responses use the same shape.

**Gate result (before research)**: PASS. **After Phase 1 design**: PASS, no new violations.
The design added only what the table above already covers.

## Project Structure

### Documentation (this feature)

```text
specs/008-oidc-auth/
├── spec.md
├── plan.md                 # this file
├── research.md             # Phase 0: R1–R17
├── data-model.md           # Phase 1: sessions.user_id, ownership, settings
├── quickstart.md           # Phase 1: end-to-end validation
├── contracts/
│   ├── auth-api.md         # Phase 1: header, 401/404/503, per-endpoint changes, backend test points
│   └── web-sign-in.md      # Phase 1: token request, configureApi, sign-in UI (for Vinod)
├── checklists/
│   └── requirements.md
└── tasks.md                # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
backend/
├── requirements.txt              # + pyjwt[crypto]>=2.10,<3
├── requirements-dev.txt          # + "--only-binary cryptography" (Intel-Mac Python, R16)
├── alembic/versions/
│   └── 0003_add_session_owner.py # new: sessions.user_id TEXT NULL
├── app/
│   ├── auth.py                   # new: load_settings(), the cached-key client subclass,
│   │                             #      get_verifier(), current_user dependency, 401/503 helpers
│   ├── models.py                 # Session.user_id
│   ├── main.py                   # lifespan → load_settings(); chat, history and list_sessions
│   │                             #      take user_id; ownership checks and 404s (R10)
│   └── feedback.py               # submit_feedback takes user_id; ownership 404 before role check
└── tests/
    ├── conftest.py               # test keys, make_token(), verifier override, client sends alice's token
    ├── test_auth.py              # new: auth-api.md test points 1–11, 20–25
    ├── test_ownership.py         # new: test points 12–19, 26
    └── test_chat.py              # unknown-session history now expects 404

dev/
└── mock-oauth2.json              # new: stand-in config (password grant → sub=username, aud=convai-api)

docker-compose.yml                # + oidc service on 8090; backend gets the OIDC_* variables
.env.example                      # new: every backend variable, plus VITE_OIDC_TOKEN_URL
README.md                         # contract section (header, 401/404/503, history 404), run with
                                  #      the stand-in, getting a token by hand, Intel-Mac note

frontend/                         # ── for Vinod's review ──
├── packages/core/src/api.ts      # configureApi: optional getToken, onUnauthorized; header and 401 hook
├── apps/web/src/
│   ├── auth/user.ts              # User.token; async signIn(username, password) via the stand-in
│   ├── auth/LoginPage.tsx        # async submit, pending state, error, notice prop, new demo text
│   ├── App.tsx                   # configureApi wiring; session-ended notice
│   ├── vite-env.d.ts             # VITE_OIDC_TOKEN_URL
│   └── __tests__/
│       ├── helpers.ts            # signInAs stores a token; fake token endpoint; 401 switch
│       └── Login.test.tsx        # web-sign-in.md test points 1–9
└── packages/core/src/__tests__/
    └── api.test.ts               # + header, 401 hook, baseUrl-only (web-sign-in.md test point 10)
```

**Structure Decision**: this keeps the existing layout. All the token logic is in one new
backend module, `app/auth.py`, and handlers take the user as an ordinary dependency, like
`get_db`. The web change stays inside the existing sign-in module and the shared API client.
No new packages, components or routes.

## Front-end changes for Vinod's review

Kept deliberately small. The full contract is in
[contracts/web-sign-in.md](./contracts/web-sign-in.md).

1. **`@convai/core` `configureApi`**: two new optional settings, `getToken` and
   `onUnauthorized`, and `baseUrl` becomes optional. Existing callers are unaffected.
2. **`auth/user.ts`**: `signIn` becomes async, takes the password, and stores the token next
   to the username under the existing `convai.user` key. Stored entries without a token count
   as signed out.
3. **`LoginPage.tsx`**: the same layout, with a "Signing in…" pending state, one error message,
   an optional notice for an ended session, and new demo-notice text.
4. **`App.tsx`**: wires `configureApi` and the session-ended notice.
5. **Tests**: `helpers.ts` and `Login.test.tsx` are updated, plus one core test.

These need Vinod's call:

- **Token in `localStorage`** (R15). It matches today's username storage and Okta's SDK
  default. The trade-off is that cross-site scripting could read the token.
- **Password grant against the stand-in** (R14). Chosen to keep the page. It will be replaced
  by Okta's own sign-in screen in the Okta follow-up.
- **The exact wording** of the three new messages.

## Risks

- **ghcr.io pulls are denied on this development machine** (R13). `docker compose pull oidc` is
  quickstart step 1, and the fix is a Docker Desktop or IT setting, not code. Until then, the
  stand-in's issuer value and the `${username}` claim mapping aren't checked against a running
  container. Quickstart step 4 checks them.
- **Dev data under stand-in subjects** won't carry over to Okta users. This is accepted in the
  spec.

## Complexity Tracking

These aren't violations. They are additions that Principle V says must be justified in the
plan.

| Addition | Why needed | Simpler alternative rejected because |
|----------|------------|-------------------------------------|
| `pyjwt[crypto]` runtime dependency (brings in `cryptography`) | Verifying RS256 and ES256 signatures and OIDC claims, and caching the provider's keys (FR-003, FR-009). The request asks for a well-maintained library with key caching. | Hand-written JWT verification is security-sensitive code we'd have to maintain. Authlib is a larger toolkit than a resource server needs (R1). |
| `oidc` service in docker compose (dev only; in-repo Python stand-in `backend/devtools/stand_in_idp.py`, because mock-oauth2-server could not be pulled from ghcr.io) | FR-023: developers need a provider that issues real signed tokens before Okta access exists. | mock-oauth2-server: Docker was denied pulls from ghcr.io (R13). Keycloak needs realm setup. The stand-in is about 100 lines on the standard library plus PyJWT, which is already a dependency. |
| One-method subclass of `PyJWKClient` | Spec edge case: keys already held keep working while the key address is down. The library's cache drops them after its lifespan expires (R2). | `cache_keys=True` would trust withdrawn keys until restart. A longer lifespan would delay picking up revocations. |
