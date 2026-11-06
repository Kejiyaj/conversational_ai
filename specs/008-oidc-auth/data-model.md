# Data Model: Sign-in Check for the Chat API

Phase 1 for [plan.md](./plan.md). Decisions are explained in [research.md](./research.md).

## Schema change: `sessions.user_id`

| Column | Type | Null | Default | Notes |
|--------|------|------|---------|-------|
| `user_id` | `text` | yes | none | The token's `sub` for the user who sent the session's first message. Set when the row is created, and never changed. `NULL` means nobody owns it, which is true of every session stored before this feature. |

- **Migration**: `backend/alembic/versions/0003_add_session_owner.py`, with revision `0003`
  following `0002`. `upgrade()` runs `op.add_column("sessions", sa.Column("user_id", sa.Text(),
  nullable=True))`, and `downgrade()` runs `op.drop_column("sessions", "user_id")`. It needs no
  backfill, no constraint and no index (R8). It works on Postgres 14 and 17 and on a database
  that already holds sessions.
- **Model**: `Session.user_id: Mapped[str | None] = mapped_column(Text)` in
  `backend/app/models.py`.
- **Unchanged**: `messages` and `feedback`. They are owned through their session.

## Ownership rules

| Entity | Owner | How the owner is found |
|--------|-------|------------------------|
| Session | `sessions.user_id` | the row itself |
| Message | the owner of its session | `messages.session_id` → `sessions.user_id` |
| Feedback | the owner of the message's session | `feedback.message_id` → `messages.session_id` → `sessions.user_id` |

A caller **owns** a session when `sessions.user_id` equals the caller's `sub` exactly
(case-sensitive, no trimming). A session with `user_id IS NULL` is owned by nobody.

### Lifecycle of `sessions.user_id`

```text
(no row) --first POST /api/chat by user U--> user_id = U   (never changes afterwards)
existing rows from before migration 0003 --> user_id = NULL (unreachable through the API)
```

- A session row is created only by `POST /api/chat`, in the same transaction as its first two
  messages, with `user_id` set to the caller. This keeps Principle III's single-transaction
  rule.
- If two users create the same session id at the same moment, the first insert wins, and the
  other request's retry sees an owner that isn't the caller, so it answers 404 (R10).
- No endpoint changes `user_id` after the row is created, and none deletes sessions.

## Caller identity (not stored)

| Field | Source | Rule |
|-------|--------|------|
| `user_id` | the token's `sub` | It must be a non-empty string. It is used as-is. Values in the body, the query or other headers are never read (FR-011). |

The token is checked against these claims (R4):

| Claim | Rule |
|-------|------|
| signature | It must verify against a key in the configured key set, chosen by the token's `kid`. Only RS*, PS* and ES* algorithms are accepted. |
| `iss` | It must equal `OIDC_ISSUER` exactly. |
| `aud` | It must equal `OIDC_AUDIENCE`, or be a list that contains it. |
| `exp` | It is required. It is refused if it is more than 60 seconds in the past. |
| `nbf` | It is optional. If present, it is refused if it is more than 60 seconds in the future. |
| `sub` | It is required and must not be empty. |

## Identity provider settings (configuration, not stored)

| Variable | Example (stand-in, docker compose) | Example (Okta, later) |
|----------|-----------------------------------|------------------------|
| `OIDC_ISSUER` | `http://localhost:8090/default` | `https://<tenant>.okta.com/oauth2/<server-id>` |
| `OIDC_AUDIENCE` | `convai-api` | the audience of the Okta authorization server, for example `api://convai` |
| `OIDC_JWKS_URL` | `http://oidc:8090/default/jwks` (`http://localhost:8090/default/jwks` when the backend runs outside Docker) | `https://<tenant>.okta.com/oauth2/<server-id>/v1/keys` |

All three are required. A missing or blank one stops the backend at startup, and the error
names the variable (FR-021).

## Web app sign-in state (browser `localStorage`)

| Key | Before | After |
|-----|--------|-------|
| `convai.user` | `{ "username": "..." }` | `{ "username": "...", "token": "<access token>" }`. An entry without `token` counts as signed out. |
| `convai.sessionIds` | unchanged | unchanged. It is kept per browser, and the backend leaves out ids the caller doesn't own. |

The password is never stored.
