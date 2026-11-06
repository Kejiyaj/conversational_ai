# Research: Sign-in Check for the Chat API

Phase 0 for [plan.md](./plan.md). Each item records the decision, why it was chosen, and what
else was considered. The library and stand-in behaviour below were checked against PyJWT
2.15.1's source and mock-oauth2-server 6.1.4's README on 2026-11-06.

## R1. JWT library: PyJWT with the `crypto` extra

- **Decision**: add `pyjwt[crypto]>=2.10,<3` to `backend/requirements.txt`. It brings in
  `cryptography` for RSA and EC signatures. Use `jwt.decode()` for the claims checks and
  `jwt.PyJWKClient` for the identity provider's keys (R2).
- **Rationale**: PyJWT is the most widely used Python JWT library, it is actively maintained
  (2.15.1 is current), and it has a built-in JWKS client with key-set caching, refresh on an
  unknown key id, a refresh cooldown, and a guard against non-http(s) key addresses. It
  checks `exp`, `nbf`, `iss` and `aud` itself, with a `leeway` setting and a `require`
  option, which covers FR-003 and FR-004 without our own claim code. Its only new transitive
  dependency is `cryptography`.
- **Alternatives considered**:
  - **python-jose**: rarely released and has had security advisories. Rejected.
  - **Authlib** (`joserfc`): capable, but it is a full OAuth client and server toolkit, which
    is more than a resource server needs, and it has no simpler JWKS caching. Rejected under
    Principle V.
  - **fastapi-azure-auth and similar wrappers**: tied to one provider. Rejected because of
    FR-020.
  - **Hand-written JWKS fetching with httpx**: avoids a cached-key subclass (R2), but
    re-implements caching, the cooldown and key parsing. Rejected.

## R2. Key caching and behaviour when the key address is down

- **Decision**: a small subclass of `PyJWKClient` in `app/auth.py`. It uses the library's
  key-set cache (`lifespan=300` seconds), the refresh on an unknown key id with its default
  30-second cooldown, and `timeout=5` seconds. It also remembers the last key set it fetched
  successfully. If a refetch fails with `PyJWKClientConnectionError` and a previous set exists,
  it keeps using that set. If no set was ever fetched, the error is turned into 503 (R9).
- **Rationale**: PyJWT's cache returns nothing once its lifespan has expired, and a failed
  refetch then raises an error even though the old keys are still valid. The spec requires
  that keys already held keep working while the address is unreachable. Overriding one
  method (about 10 lines) adds that and keeps everything else from the library. The 30-second
  cooldown limits how often a stream of tokens with unknown key ids can make us call the
  identity provider. The cost is that a newly rotated key can be refused for up to 30 seconds
  after a fetch, which meets FR-009 (no restart needed).
- **Alternatives considered**: `cache_keys=True` (a per-key LRU cache with no expiry) also
  survives outages, but it would trust a withdrawn key until restart. Rejected. A
  `lifespan` of hours was rejected because it delays picking up revoked keys.

## R3. Which signatures are accepted

- **Decision**: `algorithms=["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256",
  "ES384", "ES512"]`, a fixed list in code. The key always comes from the identity provider's
  key set, never from the token.
- **Rationale**: it covers both Okta (RS256) and the stand-in (RS256 by default), and it lists
  only public-key algorithms. So `none` and shared-secret (`HS*`) tokens are refused, as the
  spec requires. Since the list is fixed, no setting can weaken it.
- **Alternatives considered**: making the algorithm list a setting. Rejected under Principle V,
  because no provider in scope needs anything outside the list.

## R4. Claim rules

- **Decision**: `jwt.decode(token, key, algorithms=..., audience=OIDC_AUDIENCE,
  issuer=OIDC_ISSUER, leeway=60, options={"require": ["exp", "iss", "aud", "sub"]})`, then
  refuse if `sub` is not a non-empty string. `nbf` is checked when present. A token with
  several audiences passes if one of them matches (PyJWT does this already).
- **Rationale**: this maps one-to-one onto FR-003 and FR-004. Requiring `exp` stops a token
  that never expires from being accepted.
- **Alternatives considered**: also requiring `iat` or `nbf`. Not every provider sets them,
  so they aren't required.

## R5. Reading the `Authorization` header

- **Decision**: our own short parser in a FastAPI dependency. The header must have exactly two
  parts separated by a space, the first must be `bearer` in any letter case, and the second
  must not be empty. Anything else is 401.
- **Rationale**: we need an exact 401 with `{"detail": ...}` and a `WWW-Authenticate` header in
  every failure case. FastAPI's `HTTPBearer` has changed its missing-header status between
  versions, and its error body doesn't follow our rules. The parser is about 10 lines.
- **Alternatives considered**: `fastapi.security.HTTPBearer`. Rejected for the reasons above.
  It would only add a padlock in the OpenAPI docs page.

## R6. How every endpoint except health is protected

- **Decision**: each protected handler takes `user_id: str = Depends(current_user)`. A guard
  test goes through `app.routes`, calls every `/api/*` route except `GET /api/health` with no
  token, and expects 401. A new endpoint without the dependency then fails the test suite.
- **Rationale**: handlers need the user id anyway, for ownership. An explicit parameter makes
  that visible, and the guard test gives the "covers future endpoints" promise in FR-001 a
  check.
- **Alternatives considered**:
  - **App-level `dependencies=[...]`**: would also apply to health, which would then need
    moving to a separate app or router. More indirect for the same result.
  - **Middleware**: runs outside FastAPI's dependency system, so handlers would have to read
    the user from `request.state`, and it would see non-API paths too. Rejected.

## R7. Settings and failing fast at startup

- **Decision**: three environment variables, `OIDC_ISSUER`, `OIDC_AUDIENCE` and
  `OIDC_JWKS_URL`. `app/auth.py` has `load_settings()`, which raises `RuntimeError` naming
  every missing or blank variable. A FastAPI `lifespan` handler calls it, so
  `uvicorn app.main:app` exits at startup with that message. The key client is created lazily,
  by a cached `get_verifier()` dependency that the tests override, as with `get_db`.
- **Rationale**: this meets FR-021. The key client makes no network call when it is created,
  so the backend can start before the stand-in does. Keys are fetched on the first protected
  request. Alembic doesn't import `app.main`, so migrations are unaffected.
- **Alternatives considered**: checking at import time. That would break test collection and
  Alembic. A switch to turn the check off is refused by FR-021.

## R8. Where ownership is stored

- **Decision**: one new nullable column, `sessions.user_id` (text), holding the token's `sub`.
  It is set when the session row is created and never changed. Messages and feedback are owned
  through their session, with no new columns. Rows that already exist keep `NULL`, meaning
  nobody owns them (FR-018).
- **Rationale**: this is the smallest change that meets FR-012. Every ownership check starts
  from a session or a message, and a message already has `session_id`, so one primary-key
  lookup answers it. No index is needed: the session list already filters by primary key
  (`id IN (...)`), and history and feedback look up by key.
- **Alternatives considered**: `user_id` on `messages` and `feedback` as well. That duplicates
  data that can drift, and nothing needs it. A `users` table is out of scope (no profiles).
  Naming the column `owner_sub` was considered, but `user_id` reads better and will still fit
  once Okta subjects are used.

## R9. Status codes and exact responses

- **Decision**:
  - **401**: `{"detail": "missing or invalid bearer token"}`, with `WWW-Authenticate: Bearer`
    when there is no usable header, or `Bearer error="invalid_token"` when a token was given.
    The message is the same for every failed check (FR-005).
  - **404 for a session**: `{"detail": "session not found"}`, for both history and chat. The
    same response is used when the session belongs to someone else, belongs to nobody, or (for
    history) doesn't exist.
  - **404 for a message**: the existing `{"detail": "message not found"}`, used for a message
    that doesn't exist and for one in someone else's or nobody's chat.
  - **503**: `{"detail": "sign-in service unavailable, try again later"}`, when no key set has
    ever been fetched and fetching fails, or the address returns no usable signing keys.
- **Rationale**: identical 404s are what the clarification asks for (FR-017). The `WWW-
  Authenticate` values follow RFC 6750 and don't reveal which check failed.
- **Alternatives considered**: 403 for other users' data. Replaced by 404 in the
  clarification session.

## R10. Order of checks in each handler

- **Decision**:
  - **All protected endpoints**: authentication runs first, as a dependency, so a bad token
    is 401 before any input is validated.
  - **`POST /api/chat`**: the existing 400 checks, then a session lookup. If the session
    exists and `user_id` is not the caller, the answer is 404. Then `db.rollback()` releases
    the connection before the agent call. Then comes the agent call, and `_persist` creates the
    session with `user_id`. On the existing `IntegrityError` retry, which means another request
    created the same session id first, the owner is checked again, and if it differs the answer
    is 404 with nothing stored.
  - **`GET .../history`**: if the session is missing, or `user_id` is not the caller, the
    answer is 404. Then the messages are read.
  - **`GET /api/sessions`**: the existing query gains `Session.user_id == caller`.
  - **`POST .../feedback`**: the id format (400) and the body (400) are checked first, since
    neither reveals anything about the message. Then: the message is missing, or its session's
    `user_id` is not the caller, and the answer is 404. Then the assistant-only check (400),
    then the save.
- **Rationale**: the agent is never called for someone else's chat (FR-013). The connection is
  still not held during the agent call (the existing comment in `chat()` explains why). The
  ownership check comes before the role check, so another user's user message also gets 404
  (FR-016).
- **Alternatives considered**: one combined query for message and owner in feedback. It saves
  one primary-key lookup, but is less readable. Rejected under Principle V.

## R11. Tests without an identity provider

- **Decision**:
  - **Keys**: `conftest.py` creates an RSA key pair once per test session with `cryptography`,
    plus a second "wrong" key pair, and builds a key set with a `kid`.
  - **Verifier**: `get_verifier` is overridden with a verifier whose `fetch_data` returns that
    key set, or raises `PyJWKClientConnectionError` in the outage tests.
  - **Tokens**: a `make_token(sub="alice", **claims_or_headers)` helper signs tokens with
    PyJWT. Unsigned and HS256 tokens are built by hand for the refusal tests.
  - **Clients**: the existing `client` fixture now sends `Authorization: Bearer <token for
    alice>` by default, through `TestClient(app, headers=...)`. A request-level `headers=`
    argument overrides it for other users or for no token.
- **Rationale**: Principle IV, with no network, Docker or identity provider. Existing tests keep
  working as they are, because their requests carry alice's token. Only the
  unknown-session-history test changes (SC-009).
- **Alternatives considered**: running the stand-in in CI. Ruled out by FR-025.

## R12. Logging

- **Decision**: logger `app.auth`. Each refusal logs one warning with the reason. The reason is
  the PyJWT exception class name and message (for example `ExpiredSignatureError: Signature
  has expired`) or our own label (`missing header`, `bad scheme`, `empty sub`). Each 404 caused
  by ownership logs one warning that says whether the target was missing, someone else's or
  nobody's, with the session or message id. The token itself, and the decoded claims, are never
  logged.
- **Rationale**: FR-007, and the spec's edge case that the log records which 404 case it was.
  PyJWT's exception messages don't contain the token.

## R13. The local stand-in: mock-oauth2-server

- **Decision**:
  - **Image**: `ghcr.io/navikt/mock-oauth2-server:6.1.4`, pinned to an exact version, as
    service `oidc` in `docker-compose.yml`.
  - **Port**: `SERVER_PORT=8090`, published as `8090:8090`. Port 8080 is the local agent's, and
    8081 is the Expo bundler's.
  - **Config**: `dev/mock-oauth2.json`, mounted through `JSON_CONFIG_PATH`. It sets
    `"interactiveLogin": false` and one token callback for issuer `default`:
    - requests with `grant_type=password` get the claims `{"sub": "${username}", "aud":
      ["convai-api"]}`
    - `tokenExpiry` is 3600 seconds.
  - **Backend settings in compose**: `OIDC_ISSUER=http://localhost:8090/default`,
    `OIDC_AUDIENCE=convai-api`, `OIDC_JWKS_URL=http://oidc:8090/default/jwks`.
- **Rationale**:
  - The mock builds `iss` from the host the token was requested on. The browser and a
    developer's `curl` both use `localhost:8090`, so the issuer is
    `http://localhost:8090/default` either way. The backend container can't reach
    `localhost:8090`, so it fetches keys over the compose network at `oidc:8090`. This is why
    the issuer and the key address are separate settings.
  - Keeping the same port inside and outside the container avoids a second port to remember.
  - The mock adds CORS headers by itself, so the web app can call its token endpoint
    directly.
  - `${username}` templating is documented as available for every form parameter of the token
    request.
- **Alternatives considered**: Keycloak (heavy, needs a realm to be set up) and Dex (needs a
  connector configured). The spec names mock-oauth2-server, and it needs no setup.
- **Fallback used (T015)**: `docker pull ghcr.io/navikt/mock-oauth2-server:6.1.4` was denied
  again, so the in-repo Python stand-in (`backend/devtools/stand_in_idp.py`) replaces
  mock-oauth2-server. It has the same port, paths, issuer and audience, so no setting changes.
  The Risk note below applies to the image, which is no longer used.
- **Risk**: on this development machine, Docker Desktop refused to pull from ghcr.io
  (`denied`), even though anonymous pulls with `curl` work. That suggests a Docker Desktop
  registry-access policy. Quickstart step 1 checks the pull first. If it fails, ghcr.io has to
  be allowed in Docker Desktop's registry settings, or by IT. The image, the issuer value and
  the `${username}` mapping were therefore not run on this machine. Quickstart step 2 confirms
  them by decoding a real token.

## R14. How the web app gets a token from the stand-in

- **Decision**: on submit, the existing sign-in page posts a form to the stand-in's token
  endpoint (`grant_type=password`, `username`, `password`, `client_id=convai-web`,
  `scope=openid`) and keeps `access_token` from the response. The token endpoint address comes
  from `VITE_OIDC_TOKEN_URL`, defaulting to `http://localhost:8090/default/token`.
- **Rationale**:
  - It keeps the existing page and its tests almost unchanged: one `fetch`, no redirects, no
    callback route. This is what "keep front-end changes minimal" asks for.
  - The password grant is discouraged for real systems (RFC 9700), but here it runs only
    against a local test server and is never pointed at Okta.
  - The real Okta sign-in will replace this page with Okta's own sign-in screen (authorization
    code with PKCE), which is out of scope.
- **Alternatives considered**: authorization code with PKCE against the stand-in now. It is
  closer to Okta, but it needs a redirect, a callback route and code-verifier storage, which
  means more web changes and the stand-in's own sign-in screen instead of ours. It is deferred
  to the Okta work.

## R15. Where the web app keeps the token, and what it does on 401

- **Decision**:
  - **Storage**: the token is stored with the username, under the existing `convai.user` key
    in `localStorage`, as `{ "username", "token" }`. `getUser()` returns `null` when there is
    no token, so entries stored before this change send the user back to sign in.
  - **Sending it**: `configureApi()` in `@convai/core` gains two optional settings:
    `getToken()`, which supplies the token for every request, and `onUnauthorized()`, which is
    called on any 401.
  - **On 401**: the web app's handler signs out and shows the sign-in page with "Your session
    has ended. Sign in again."
- **Rationale**:
  - It keeps today's behaviour, where a reload keeps you signed in.
  - The shared package doesn't learn about storage or the router, so the mobile app's existing
    `configureApi({ baseUrl })` call still compiles.
  - Okta's own browser SDK also keeps tokens in `localStorage` by default. The risk that a
    cross-site scripting flaw could read the token is noted in the plan, and is accepted for a
    test-only token.
- **Alternatives considered**:
  - `sessionStorage`: you would be signed out per tab, a change in behaviour.
  - Memory only: you would be signed out on every reload.
  - An HTTP-only cookie: needs a backend session and CSRF protection, which is out of scope.

## R16. Installing `cryptography` on Intel-Mac Python

- **Decision**: add `--only-binary cryptography` as the first line of
  `backend/requirements-dev.txt`. The Docker image, which installs `requirements.txt` on Linux,
  is unaffected.
- **Rationale**: `cryptography` 49 and later publish macOS wheels for arm64 only. This
  machine's `backend/.venv` uses an x86_64 Python 3.12.8, so `pip` would try to build 50.x
  from source, which needs Rust. With `--only-binary`, pip falls back to 48.0.1, which ships a
  universal2 wheel. This was checked with `uv pip install --only-binary :all: --dry-run`.
- **Alternatives considered**: pinning `cryptography<49` in `requirements.txt`. That would hold
  back the Linux image for one developer setup. Rejected. Recreating the virtualenv with an
  arm64 Python also fixes it, and the README says so.

## R17. Contract changes and who they affect (Principle I)

- **Decision**: the contract changes are:
  - the required `Authorization` header
  - 401 and 503 on every protected endpoint
  - 404 for other users' and nobody's sessions and messages
  - 404 instead of an empty list for the history of a chat that doesn't exist
  - the session list leaving out other users' chats.

  Request and response bodies don't change. The affected consumers are the web app (updated in
  this change, so Vinod reviews it), the back-end tests (updated), and anyone calling the API
  by hand (the README explains how to get a token). The mobile app imports only
  `splitDisclaimer` from `@convai/core` and makes no API calls. The agent contract doesn't
  change.
- **Rationale**: Principle I allows a breaking change when a spec names every consumer and they
  are updated together, and both contract owners review.
