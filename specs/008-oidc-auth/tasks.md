---

description: "Task list for the sign-in check for the chat API (OIDC token validation)"
---

# Tasks: Sign-in Check for the Chat API (OIDC Token Validation)

**Input**: Design documents from `specs/008-oidc-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/auth-api.md](./contracts/auth-api.md),
[contracts/web-sign-in.md](./contracts/web-sign-in.md), [quickstart.md](./quickstart.md)

**Tests**: required. FR-026 and Constitution Principle IV require a test for every case in the
contracts, and the project works test-first. Each story's tests are written first and must fail
before the implementation tasks.

**Order**: as requested, the backend check and its tests come first (US1, US2, US4), then the
stand-in (US5), then the web changes (US3). US3 is P1, but it needs the stand-in, so it comes
last. All of it ships in one PR, because once US1 lands the web app can't call the API without
US3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: the user story from spec.md (US1–US5)

---

## Phase 1: Setup

- [X] T001 Add `pyjwt[crypto]>=2.10,<3` to `backend/requirements.txt`, and add `--only-binary cryptography` as the first line of `backend/requirements-dev.txt` (research R16). Then run `pip install -r requirements-dev.txt` in `backend/.venv` and check that `python -c "import jwt, cryptography"` works.

---

## Phase 2: Foundational (blocks every story)

- [X] T002 Create `backend/app/auth.py` with:
  - `load_settings()`: reads `OIDC_ISSUER`, `OIDC_AUDIENCE` and `OIDC_JWKS_URL`, and raises `RuntimeError` naming every missing or blank variable.
  - `ALGORITHMS = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512"]` (R3).
  - `CachedKeyClient(PyJWKClient)`, built with `lifespan=300`, `timeout=5` and the default 30-second cooldown. It overrides `fetch_data()` to remember the last key set fetched successfully, and to return that set when a refetch raises `PyJWKClientConnectionError` (R2).
  - `get_verifier()`: an `lru_cache` function returning the settings and a `CachedKeyClient` for `OIDC_JWKS_URL`. It makes no network call when it is created.
- [X] T003 Add the auth fixtures to `backend/tests/conftest.py` (R11), which depends on T002:
  - **Keys:** a session-scoped RSA key pair, a second "wrong" pair, and a key set dict whose key has `kid` `"test-key"`.
  - **Settings:** `monkeypatch.setenv` for `OIDC_ISSUER=https://idp.test/default`, `OIDC_AUDIENCE=convai-api` and `OIDC_JWKS_URL=https://idp.test/default/jwks`.
  - **Verifier:** a fixture that overrides `get_verifier` with one whose `fetch_data` returns the test key set. A switch makes it raise `PyJWKClientConnectionError` instead.
  - **Tokens:** `make_token(sub="alice", key=..., headers=..., **claims)`, with defaults for `iss`, `aud`, `iat` and `exp` = now + 300.
  - **Client:** the existing `client` fixture becomes `TestClient(app, headers={"Authorization": f"Bearer {make_token()}"})`, so existing tests run as alice.

**Checkpoint**: `pytest` still passes. Nothing checks tokens yet.

---

## Phase 3: User Story 1 - Refuse callers who can't prove who they are (P1) 🎯 MVP

**Goal**: every endpoint except health refuses a missing or invalid token with 401.

**Independent Test**: contract test points 1–11, 20 and 25 pass. Health answers without a
token.

- [X] T004 [US1] Write `backend/tests/test_auth.py` covering test points 1–11, 20 and 25 in `contracts/auth-api.md`. Include the guard test that goes through every `/api/*` route in `app.routes` except `GET /api/health`, and expects 401 with no token. Check the exact body `{"detail": "missing or invalid bearer token"}`, the `WWW-Authenticate` value (`Bearer`, or `Bearer error="invalid_token"`), that the agent is not called and nothing is stored, and with `caplog` that each refusal logs a reason and the token string never appears. Run it and confirm it fails.
- [X] T005 [US1] Add `current_user` to `backend/app/auth.py`. It depends on T002.
  - **Header (R5):** exactly two space-separated parts, the scheme `bearer` in any letter case, and a non-empty token. Anything else is 401.
  - **Checks:** `jwt.decode(token, key, algorithms=ALGORITHMS, audience=..., issuer=..., leeway=60, options={"require": ["exp", "iss", "aud", "sub"]})`, then refuse unless `sub` is a non-empty string (R4).
  - **401:** for any `jwt.PyJWTError`, and for a `PyJWKClientError` about an unknown `kid`.
  - **503:** `{"detail": "sign-in service unavailable, try again later"}`, when no key set can be fetched or the set has no usable signing keys (R9). `PyJWKClientConnectionError` is a subclass of `PyJWKClientError`, so catch it first.
  - **Logging:** one warning per refusal on logger `app.auth`, with the reason and never the token (R12).
  - **Returns:** `sub`.
- [X] T006 [US1] Add `user_id: str = Depends(current_user)` to `chat`, `history` and `list_sessions` in `backend/app/main.py`, and to `submit_feedback` in `backend/app/feedback.py`. Do not add it to `health`. Run `pytest`: `test_auth.py` and every existing test pass.

**Checkpoint**: the API is closed to callers without a valid token.

---

## Phase 4: User Story 2 - Each user sees and stores only their own conversations (P1)

**Goal**: sessions record their owner, and other users' or nobody's data answers 404, the
same as data that doesn't exist.

**Independent Test**: contract test points 12–19 and 26 pass.

- [X] T007 [P] [US2] Write `backend/tests/test_ownership.py` covering test points 12–19 and 26 in `contracts/auth-api.md`.
  - Bob uses `make_token(sub="bob")`.
  - The race test makes the agent call insert a bob-owned session with the same id, so alice's `_persist` hits the `IntegrityError` retry and answers 404 with no alice messages stored.
  - Also change `test_history_for_unknown_session_is_empty_and_creates_nothing` in `backend/tests/test_chat.py` to expect 404 `{"detail": "session not found"}` and no new row, and rename it to match.
  - Run them and confirm they fail.
- [X] T008 [P] [US2] Add `user_id: Mapped[str | None] = mapped_column(Text)` to `Session` in `backend/app/models.py`. Create `backend/alembic/versions/0003_add_session_owner.py`, with revision `"0003"` and `down_revision` `"0002"`. `upgrade()` adds the column, which is nullable with no backfill, no constraint and no index (data-model.md). `downgrade()` runs `op.drop_column("sessions", "user_id")`.
- [X] T009 [US2] Ownership in `backend/app/main.py` (R10). It depends on T008.
  - **`chat`:** after the 400 checks, look up the session. If it exists and `user_id != caller`, answer 404 `{"detail": "session not found"}`. Then `db.rollback()` before `_reply_for`, so no connection is held during the agent call.
  - **`_persist`:** takes `user_id` and sets it on a new `Session`. On the `IntegrityError` retry, check the owner again and answer 404 if it differs.
  - **`history`:** answer the same 404 when the session is missing, or its `user_id` is not the caller.
  - **`list_sessions`:** add `.where(models.Session.user_id == user_id)`.
  - **Logging:** log one warning per ownership 404, saying whether the target was missing, someone else's or nobody's (R12).
- [X] T010 [US2] Ownership in `backend/app/feedback.py`. After `parse_message_id` and `parse_feedback_body`, answer 404 `{"detail": "message not found"}` when the message is missing, **or** `db.get(models.Session, message.session_id).user_id != user_id`. Do this before the assistant-only check (FR-016), and log a warning for the case. Run `pytest`: everything passes.
- [X] T011 [US2] Check the migration on Postgres: `docker compose up -d db`, then `alembic upgrade head` and `alembic check` from `backend/` with `DATABASE_URL=postgresql://app:app@localhost:5432/convai`. Confirm that `\d sessions` shows `user_id text` as nullable, and that existing rows keep `NULL`.

**Checkpoint**: the backend side of the spec is done, except for startup config.

---

## Phase 5: User Story 4 - Switch identity provider by configuration only (P2)

**Goal**: everything specific to the identity provider is configuration. A missing setting stops
startup, and an outage or key rotation is handled.

**Independent Test**: contract test points 21–24 pass, and the suite passes under a second set of
settings.

- [X] T012 [US4] Add tests to `backend/tests/test_auth.py` covering test points 21–24 in `contracts/auth-api.md`:
  - a fetch fails before any key set has been fetched: 503
  - a fetch fails after the cache has expired: the known `kid` still gets 200
  - a key that appears after a refresh is accepted: use `cooldown_duration=0` in the test verifier
  - `load_settings()` names a missing or blank variable
  - `with TestClient(app)` fails when `OIDC_AUDIENCE` is unset.

  Also add an SC-005 test: with a second issuer and audience set through `monkeypatch`, a token for the first set gets 401 and a matching token gets 200. Run them and confirm the startup test fails.
- [X] T013 [US4] Add a FastAPI `lifespan` to `backend/app/main.py` that calls `auth.load_settings()`, so `uvicorn app.main:app` exits at startup naming the missing variable (R7). Run `pytest`: everything passes.
- [X] T014 [P] [US4] Create `.env.example` at the repository root. List `DATABASE_URL`, `AGENT_URL`, `OIDC_ISSUER=http://localhost:8090/default`, `OIDC_AUDIENCE=convai-api` and `OIDC_JWKS_URL=http://localhost:8090/default/jwks`, plus `VITE_OIDC_TOKEN_URL=http://localhost:8090/default/token`, commented as a web-app variable. Give each a one-line comment.

**Checkpoint**: the backend is complete and tested offline. Next is the stand-in.

---

## Phase 6: User Story 5 - Develop and test without a real identity provider (P2)

**Goal**: `docker compose up` runs a stand-in identity provider on port 8090 that issues tokens
the backend accepts.

**Independent Test**: quickstart steps 3–6 pass against the running stack.

- [X] T015 [US5] **Decision gate:** run `docker pull ghcr.io/navikt/mock-oauth2-server:6.1.4`. If it succeeds, do **path A** (T016–T017) and skip path B. If it fails with `denied`, or any other registry error, do **path B** (T018–T020) and skip path A. Record the result in the PR description.
- [X] T016 [US5] Path A: create `dev/mock-oauth2.json` (R13), with `"interactiveLogin": false` and one token callback for `issuerId` `"default"`, `tokenExpiry` 3600. Its request mapping is `requestParam` `"grant_type"`, `match` `"password"`, with claims `{"sub": "${username}", "aud": ["convai-api"]}`.
- [X] T017 [US5] Path A: in `docker-compose.yml`:
  - **Add service `oidc`:** image `ghcr.io/navikt/mock-oauth2-server:6.1.4`, `ports: ["8090:8090"]`, environment `SERVER_PORT: "8090"` and `JSON_CONFIG_PATH: /config/mock-oauth2.json`, and the volume `./dev/mock-oauth2.json:/config/mock-oauth2.json:ro`.
  - **Backend environment:** `OIDC_ISSUER: http://localhost:8090/default`, `OIDC_AUDIENCE: convai-api` and `OIDC_JWKS_URL: http://oidc:8090/default/jwks`.
  - **Backend `depends_on`:** `[db, oidc]`.
- [X] T018 [US5] Path B: write `backend/tests/test_stand_in_idp.py` first.
  - It calls the stand-in's token and key-set functions directly, with no network.
  - It checks that a token for `alice` passes the backend's `jwt.decode` with the stand-in's key set and the issuer and audience settings.
  - It checks that `grant_type` other than `password`, or an empty `username`, is refused with 400 `{"error": "invalid_request"}`.
  - It checks that responses echo the request's `Origin` in `Access-Control-Allow-Origin`.
  - Confirm it fails.
- [X] T019 [US5] Path B: create `backend/devtools/__init__.py` and `backend/devtools/stand_in_idp.py`, a dev-only stand-in using only the standard library's `http.server.ThreadingHTTPServer` plus PyJWT and `cryptography`, which are already dependencies. It must offer the same paths and claims as path A, so nothing else changes:
  - **Settings:** `STAND_IN_PORT` (default `8090`), `STAND_IN_ISSUER` (default `http://localhost:8090/default`) and `STAND_IN_AUDIENCE` (default `convai-api`). It binds to `0.0.0.0`.
  - **Signing key:** an RSA 2048 key generated at startup, with `kid` `"stand-in-1"`, signing RS256.
  - **`POST /default/token`:** takes a form with `grant_type=password` and `username`. It returns `{"access_token", "token_type": "Bearer", "expires_in": 3600}`, with claims `iss`, `aud: [audience]`, `sub: username`, `iat`, `nbf` and `exp` = now + 3600.
  - **`GET /default/jwks`:** the public key set.
  - **`GET /default/.well-known/openid-configuration`:** `issuer`, `token_endpoint` and `jwks_uri`.
  - **CORS:** every response echoes `Origin`. `OPTIONS` answers 204 with `Access-Control-Allow-Methods: POST, GET, OPTIONS` and the requested headers allowed.
  - **Logging:** one line per request, never the token.
  - Run `pytest`: everything passes.
- [X] T020 [US5] Path B: wire it up and record the decision.
  - **`docker-compose.yml`:** add service `oidc` with `build: ./backend`, `command: python -m devtools.stand_in_idp`, the volume `./backend/devtools:/app/devtools:ro` and `ports: ["8090:8090"]`. Give the backend the same `OIDC_*` environment and `depends_on` as in T017.
  - **`research.md` R13:** add "Fallback used: ghcr.io pull denied, so the in-repo Python stand-in replaces mock-oauth2-server", and update the quickstart step 1 image name.
  - **`plan.md` Complexity Tracking:** add the `backend/devtools/` row, which replaces the mock-oauth2-server row.
- [X] T021 [US5] Run `docker compose up --build -d`, then follow `quickstart.md` steps 3–6: the migration runs, the decoded token has `sub` `alice`, `aud` `["convai-api"]` and `iss` `http://localhost:8090/default`, no token gives 401, alice's chat gives 200 with `user_id = alice`, and bob gets 404 and an empty list.

**Checkpoint**: the backend and the stand-in work together in Docker. Next are the web changes.

---

## Phase 7: User Story 3 - Sign in to the web app and chat (P1) — for Vinod's review

**Goal**: the existing sign-in page gets a token from the stand-in, every API call sends it,
and a 401 returns the user to sign-in. Keep the change to the files listed in
[contracts/web-sign-in.md](./contracts/web-sign-in.md).

**Independent Test**: web-sign-in.md test points 1–10 pass, and quickstart step 7 works in
the browser.

- [X] T022 [P] [US3] In `frontend/packages/core/src/__tests__/api.test.ts`, add web-sign-in.md test point 10 and tests for section 2: the `Authorization: Bearer <token>` header is sent when `getToken()` returns a token and left out otherwise, `Content-Type` is kept, `onUnauthorized` is called once on a 401 and the call then throws `Request failed (401)`, and `configureApi({ baseUrl })` alone still works. Confirm they fail.
- [X] T023 [US3] Update `frontend/apps/web/src/__tests__/helpers.ts`:
  - `signInAs` stores `{ username, token: "test-token" }`.
  - `installServer` answers `POST http://localhost:8090/default/token` with `{ access_token: "token-for-<username>" }`, with a `failToken` switch that answers 500.
  - It records each call's `Authorization` header in `calls`.
  - A `rejectToken` switch makes every `/api/*` call answer 401.

  Then write web-sign-in.md test points 1–9 in `frontend/apps/web/src/__tests__/Login.test.tsx`, replacing the old "nothing is sent to a server" expectations. Confirm they fail.
- [X] T024 [P] [US3] In `frontend/packages/core/src/api.ts`, change `configureApi` to take optional `{ baseUrl?, getToken?, onUnauthorized? }` and merge only the options given. Make `request()` send `Authorization: Bearer <token>` when there is a token, keep the call's own headers, and call `onUnauthorized()` on a 401 before throwing. The exported types and the four call signatures don't change.
- [X] T025 [US3] Update the web sign-in state, which depends on T024:
  - **`frontend/apps/web/src/auth/user.ts`:** `User` gains `token: string`. `getUser()` returns `null` without a token. `signIn(username, password): Promise<User>` posts `grant_type=password`, the trimmed `username`, `password`, `client_id=convai-web` and `scope=openid` as a form to `import.meta.env.VITE_OIDC_TOKEN_URL ?? "http://localhost:8090/default/token"`. It stores `{ username, token: access_token }`, and throws while storing nothing on a non-2xx response or a network error. The password is never stored.
  - **`frontend/apps/web/src/vite-env.d.ts`:** declare `VITE_OIDC_TOKEN_URL?: string`.
- [X] T026 [US3] Update `frontend/apps/web/src/auth/LoginPage.tsx`:
  - `onSignIn: (username, password) => Promise<void>`.
  - While the request is in flight, the button is disabled and reads "Signing in…".
  - On failure, show "Couldn't sign in. Check that the local sign-in service is running, then try again." above the button, and keep the fields filled.
  - Add an optional `notice` prop, shown above the form.
  - The demo text becomes "Sign-in uses a local test identity provider. Any username and password works."
- [X] T027 [US3] Update `frontend/apps/web/src/App.tsx`. Call `configureApi({ getToken: () => getUser()?.token ?? null, onUnauthorized })`, where `onUnauthorized` runs `signOut()`, clears the user and sets the notice "Your session has ended. Sign in again." Pass `(username, password) => signIn(username, password).then(setUser)` to `LoginPage`, and clear the notice on a successful sign-in. Run `npm test` and `npm run build` in `frontend/`: everything passes, and the mobile app still type-checks.
- [ ] T028 [US3] Run `quickstart.md` step 7 in the browser against the running stack: sign in as `jane` and chat, check the stored `user_id`, sign in as `vinod` and confirm Jane's chat is hidden, check that a tampered token returns you to sign-in with the notice, and check that a stopped `oidc` service shows the sign-in error.

**Checkpoint**: every user story works from end to end.

---

## Phase 8: Polish

- [X] T029 [P] Update `README.md`. In the API contract section, add the required `Authorization: Bearer` header, the 401 and 503 responses, 404 for other users' and unknown chats, history of an unknown chat now answering 404 instead of `"messages": []`, and the session list leaving out other users' chats. Link `specs/008-oidc-auth/contracts/`. Under "Run locally", add the `oidc` stand-in on port 8090 and how to get a token by hand (quickstart step 4), the three `OIDC_*` settings with a pointer to `.env.example`, and the Intel-Mac `cryptography` note (R16).
- [X] T030 Final check:
  - with Docker stopped and no network, `cd backend && pytest` passes, and `cd frontend && npm test && npm run build` passes
  - quickstart step 8: `docker compose run --rm -e OIDC_AUDIENCE= backend` exits naming `OIDC_AUDIENCE`
  - `docker compose logs backend` contains no token string.

  Open the PR with Vinod as reviewer for the `frontend/` files and the contract change, and list the T015 path taken.

---

## Dependencies & Execution Order

- **Setup (T001)**: comes first.
- **Foundational (T002–T003)**: depends on T001 and blocks every story.
- **US1 (T004–T006)**: depends on Phase 2.
- **US2 (T007–T011)**: depends on US1, because the handlers need `user_id` from `current_user`.
- **US4 (T012–T014)**: depends on Phase 2 and on `current_user` (T005). T014 can be done at any point.
- **US5 (T015–T021)**: depends on US1, US2 and US4, so that the stack it runs is the finished backend. Only one of path A and path B is done.
- **US3 (T022–T028)**: its tests and code (T022–T027) only need the contracts and could start after Phase 2. The browser check (T028) needs US5 running. It comes last because you asked for that order.
- **Polish (T029–T030)**: comes after everything else.

Within each story, the tests come first and must fail, then the model and migration, then the
handlers, then a full test run.

## Parallel Opportunities

- **T007 and T008**: the ownership tests and the model/migration are in different files.
- **T014**: `.env.example` doesn't depend on anything else in its phase.
- **T022 and T024**: the core tests and `api.ts` can go to one person while another does T023.
- **T029**: the README can be written alongside T028.

```bash
# US2: start together
Task: "Write backend/tests/test_ownership.py (test points 12–19, 26) and update test_chat.py unknown-history test"
Task: "Add Session.user_id and migration backend/alembic/versions/0003_add_session_owner.py"

# US3: start together
Task: "Core api.test.ts header and 401 tests (web-sign-in.md section 2, point 10)"
Task: "helpers.ts fake token endpoint + Login.test.tsx points 1–9"
```

## Implementation Strategy

1. **Backend MVP (T001–T011)**: once these are done, the API is closed and private per user,
   which delivers the core of BL-001. It is verified by `pytest` alone.
2. **Config and startup (T012–T014)**: makes the switch to Okta a settings change.
3. **Stand-in (T015–T021)**: the stack runs end to end with real signed tokens.
4. **Web (T022–T028)**: the app signs in and chats again. The PR can't merge before this,
   because the web app is broken between steps 1 and 4.
5. **Polish (T029–T030)**: the README, the final offline test run, and the PR with Vinod as
   reviewer.

## Notes

- 30 tasks in all. Under path A, T018–T020 are skipped. Under path B, T016–T017 are skipped.
- Status codes and messages are exact strings from `contracts/auth-api.md`. Don't paraphrase
  them.
- The token must never appear in logs, test output or error bodies.
