# Contract: Bearer Token on the Chat API

Spec: [spec.md](../spec.md). Decisions: [research.md](../research.md) R5, R9, R10.
Consumers: the web app (`frontend/packages/core/src/api.ts`, owner Vinod), the back-end tests,
and anyone calling the API by hand. The mobile app makes no API calls yet. The agent contract
is unchanged.

## Request header

Every endpoint except `GET /api/health` requires:

```text
Authorization: Bearer <access token>
```

- The scheme word `Bearer` is matched without regard to letter case. The value must be exactly
  `<scheme> <token>`, with one space and a non-empty token.
- A token in the query string, a cookie or the body is ignored.
- `GET /api/health` ignores the header completely.

## Responses added to every protected endpoint

| Status | When | Body | Extra header |
|--------|------|------|--------------|
| 401 | there is no `Authorization` header, or it is not `Bearer <token>` | `{"detail": "missing or invalid bearer token"}` | `WWW-Authenticate: Bearer` |
| 401 | the token is malformed or unsigned, uses a shared secret, has a bad signature or an unknown `kid`, has expired (beyond 60 seconds), is not yet valid, or has the wrong `iss`, the wrong `aud`, or a missing or empty `sub` | `{"detail": "missing or invalid bearer token"}` | `WWW-Authenticate: Bearer error="invalid_token"` |
| 503 | no key set has ever been fetched and fetching fails, or the key address returns no usable signing keys | `{"detail": "sign-in service unavailable, try again later"}` | none |

Authentication runs before any other check, so a request with a bad token gets 401 even if its
body is also invalid. A 401 or 503 has no side effects: the agent is not called and nothing is
stored.

## Per-endpoint changes

Request and response bodies are unchanged everywhere. Only the cases below are new or
different.

### `POST /api/chat`

| Case | Before | After |
|------|--------|-------|
| new `session_id` | 200, session created | 200, session created with `user_id` = the caller |
| the caller's own session | 200 | 200, unchanged |
| a session owned by someone else, or by nobody | 200, message appended | **404** `{"detail": "session not found"}`. The agent is not called and nothing is stored. |

### `GET /api/chat/{session_id}/history`

| Case | Before | After |
|------|--------|-------|
| the caller's own session | 200 with the messages | 200, unchanged |
| a session owned by someone else, or by nobody | 200 with the messages | **404** `{"detail": "session not found"}` |
| a session that doesn't exist | 200 `{"session_id": "...", "messages": []}` | **404** `{"detail": "session not found"}`. Nothing is created. |

### `GET /api/sessions?ids=...`

| Case | Before | After |
|------|--------|-------|
| an id of the caller's own session | included | included, unchanged |
| an id of a session owned by someone else, or by nobody | included | **left out** silently, like an unknown id |
| more than 200 ids, or no ids | 400, or an empty list | unchanged |

### `POST /api/messages/{message_id}/feedback`

The checks run in this order. The first failure wins.

1. Token: 401 or 503, as above.
2. `message_id` format: 400, unchanged.
3. Body: 400, unchanged.
4. The message doesn't exist, **or its session is owned by someone else or by nobody**: 404
   `{"detail": "message not found"}`.
5. A user message: 400 `{"detail": "feedback is only allowed on assistant messages"}`. This
   is now reachable only by the owner.
6. Save: 200, unchanged.

## Test points (backend)

Each one has at least one automated test (FR-026). "Alice" and "Bob" are two valid subjects.

1. Each protected endpoint with no `Authorization` header gets 401, `WWW-Authenticate:
   Bearer`, and the agent is not called and nothing is stored. A guard test goes through
   every `/api/*` route in `app.routes` except health.
2. A header with the wrong scheme (`Basic x`), only `Bearer`, `Bearer` with an empty token,
   or three parts gets 401.
3. `bearer <valid>` and `BEARER <valid>` get 200.
4. A token that isn't a JWT (`abc`) gets 401.
5. A token signed with a key that isn't in the key set gets 401. So does a token with a `kid`
   that isn't in the key set.
6. A token with `alg: none`, and one signed with HS256 using the public key as the secret, get
   401.
7. A token that expired 61 seconds ago gets 401. One that expired 30 seconds ago gets 200.
8. A token with `nbf` 61 seconds in the future gets 401.
9. A token with the wrong `iss` gets 401. A token without `iss` gets 401.
10. A token with the wrong `aud`, or without `aud`, gets 401. A token with `aud: ["other",
    "<configured>"]` gets 200.
11. A token without `sub`, or with `sub: ""`, gets 401.
12. A valid token for Alice on `POST /api/chat` gets 200, and the new session's `user_id` is
    `alice`.
13. A `user_id` field in the chat body is ignored, and the session is still Alice's.
14. Alice gets 200 for her own history, with the same body as before.
15. Bob gets 404 `session not found` for Alice's history. The history of a session id that
    doesn't exist gets the same response, and no row is created.
16. Bob's `POST /api/chat` into Alice's session gets 404. The agent is not called, and no
    message is added.
17. Bob's feedback on Alice's assistant message gets 404 `message not found`, and Alice's
    feedback is unchanged. Bob's feedback on Alice's *user* message also gets 404, not 400.
18. Bob's `GET /api/sessions?ids=<alice's id>&ids=<bob's id>` returns only Bob's session.
19. A session with `user_id` NULL gets 404 for history, chat and feedback, and is left out of
    the list.
20. `GET /api/health` with no token, an invalid token or an expired token gets 200.
21. Fetching the key set fails before any key set has been fetched: 503, with the standard
    body.
22. Fetching the key set fails after a successful fetch, once the cache has expired: a token
    with a known `kid` still gets 200.
23. A token signed with a new key that appears in the key set after a refresh gets 200 without
    a restart.
24. `load_settings()` with any of the three variables missing or blank raises an error naming
    the variable. Starting the app (`with TestClient(app)`) with one missing fails.
25. Each refusal logs a warning with its reason. The log never contains the token string.
26. A race: two users create the same new session id. One gets 200, the other 404, and the
    session holds messages from one user only.
