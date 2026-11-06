# Quickstart: Validate the Sign-in Check

This guide proves the feature works from end to end. The API rules are in
[contracts/auth-api.md](./contracts/auth-api.md), the web sign-in in
[contracts/web-sign-in.md](./contracts/web-sign-in.md), and the schema change in
[data-model.md](./data-model.md).

## Prerequisites

- Docker Desktop is running.
- Port 8090 is free. The stand-in uses it, so that it doesn't clash with the agent on 8080.
- For the automated tests: a Python 3.12 virtualenv in `backend/` with `requirements-dev.txt`
  installed, and `npm install` run in `frontend/`. On an Intel-Mac Python,
  `requirements-dev.txt` installs a prebuilt `cryptography` wheel (research R16).

## 1. The stand-in builds

```bash
docker compose build oidc
```

Expected: it builds from the backend image. (mock-oauth2-server could not be pulled from ghcr.io
on the development machine, so the in-repo stand-in is used. See research R13.)

## 2. Automated tests (no identity provider, no network)

```bash
cd backend && pytest
cd ../frontend && npm test
```

Expected: everything passes with Docker stopped and no network. That includes every test point
in both contracts and the existing suites. The only existing back-end test whose expectation
changes is the history of an unknown session, which now expects 404.

## 3. Start the stack and check the migration

```bash
docker compose up --build -d
docker compose logs backend | grep -i "running upgrade"      # → ... 0002 -> 0003
docker compose exec db psql -U app -d convai -c '\d sessions' # → user_id | text | nullable
```

## 4. Get a token from the stand-in and check what it contains

```bash
TOKEN=$(curl -s -X POST http://localhost:8090/default/token \
  -d grant_type=password -d username=alice -d password=x \
  -d client_id=convai-web -d scope=openid | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
python3 -c 'import base64,json,sys;p=sys.argv[1].split(".")[1];print(json.loads(base64.urlsafe_b64decode(p+"="*(-len(p)%4))))' "$TOKEN"
```

Expected: the claims include `"sub": "alice"`, `"aud": ["convai-api"]` and
`"iss": "http://localhost:8090/default"`, and they match `OIDC_ISSUER` and `OIDC_AUDIENCE` in
`docker-compose.yml`. If `iss` differs, the token was requested on a different host from the
one in `OIDC_ISSUER` (research R13).

## 5. The API refuses and accepts as specified

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:8000/api/health                   # 200
curl -s -i -X POST http://localhost:8000/api/chat -H 'Content-Type: application/json' \
  -d '{"session_id":"qs-1","message":"hi"}' | sed -n '1p;/WWW-Authenticate/p'               # 401, Bearer
curl -s -X POST http://localhost:8000/api/chat -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"session_id":"qs-1","message":"hi"}'             # 200, reply
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer ${TOKEN}x" \
  http://localhost:8000/api/chat/qs-1/history                                              # 401
docker compose exec db psql -U app -d convai -tc "select user_id from sessions where id='qs-1'"  # alice
```

## 6. Another user's chat looks like it doesn't exist

```bash
BOB=$(curl -s -X POST http://localhost:8090/default/token -d grant_type=password -d username=bob \
  -d password=x -d client_id=convai-web -d scope=openid | python3 -c 'import json,sys;print(json.load(sys.stdin)["access_token"])')
curl -s -H "Authorization: Bearer $BOB" http://localhost:8000/api/chat/qs-1/history          # 404 session not found
curl -s -H "Authorization: Bearer $BOB" http://localhost:8000/api/chat/no-such-id/history    # same response
curl -s -H "Authorization: Bearer $BOB" 'http://localhost:8000/api/sessions?ids=qs-1'         # {"sessions":[]}
```

Then rate Alice's answer as Bob, using the `message_id` from the 200 reply in step 5:
`POST /api/messages/<id>/feedback` with `{"rating":"up"}` and Bob's token gives 404
`message not found`.

## 7. Web app sign-in

```bash
cd frontend && npm run web    # http://localhost:5173
```

1. Sign in as `jane` with any password. The chat screen appears. In the browser's network tab,
   there is one `POST` to `localhost:8090/default/token`, and every `/api/*` request carries
   `Authorization: Bearer ...`.
2. Send a message. The reply appears, and `select user_id from sessions` shows `jane` for the
   new session.
3. Sign out and sign in as `vinod`. Jane's chat is not in History.
4. In the browser's dev tools, change the `token` inside `localStorage["convai.user"]` to
   `bad`, then send a message. The web app returns to the sign-in page with "Your session has
   ended. Sign in again."
5. Run `docker compose stop oidc` and try to sign in. The sign-in page shows "Couldn't sign
   in...", and you stay on it.

## 8. Missing settings stop the backend

```bash
docker compose run --rm -e OIDC_AUDIENCE= backend
```

Expected: the backend exits at startup with an error that names `OIDC_AUDIENCE`.
