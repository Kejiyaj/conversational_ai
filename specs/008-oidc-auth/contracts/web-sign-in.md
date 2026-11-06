# Contract: Web Sign-in Through the Stand-in

> **For Vinod's review.** This is the whole front-end change in this feature. It touches the
> shared API client in `@convai/core` and the web app's sign-in. There are no visual changes,
> apart from the demo notice text, a pending state on the button and two messages.

Spec: [spec.md](../spec.md), User Story 3 and FR-027 to FR-032. Decisions:
[research.md](../research.md) R14 and R15.

## 1. Token request (web app → stand-in identity provider)

```http
POST {VITE_OIDC_TOKEN_URL}            # default http://localhost:8090/default/token
Content-Type: application/x-www-form-urlencoded

grant_type=password&username=<username>&password=<password>&client_id=convai-web&scope=openid
```

| Response | Meaning for the web app |
|----------|-------------------------|
| 200 `{"access_token": "...", "token_type": "Bearer", "expires_in": 3600, ...}` | Signed in. Keep `access_token`. |
| any other status, or a network error | Sign-in failed. Stay on the sign-in page and show the error in section 4. |

- The username is trimmed, as today. The stand-in puts it in the token's `sub`.
- The stand-in doesn't check the password. It is sent because the grant requires it, and it is
  never stored.
- This request goes straight to the stand-in, not through `/api`, because it is not a backend
  call. The stand-in sends its own CORS headers.

## 2. Shared API client (`frontend/packages/core/src/api.ts`)

```ts
export function configureApi(options: {
  baseUrl?: string;                    // unchanged meaning; now optional
  getToken?: () => string | null;      // new
  onUnauthorized?: () => void;         // new
}): void;
```

- Each option is optional, and calling `configureApi` again updates only the options it is
  given. The mobile app's `configureApi({ baseUrl })` keeps working.
- Every request made by `sendMessage`, `getHistory`, `listSessions` and `submitFeedback` sends
  `Authorization: Bearer <token>` when `getToken()` returns a token, and no `Authorization`
  header otherwise. Headers the call already sets, such as `Content-Type`, are kept.
- On a 401 response, `onUnauthorized()` is called once for that request, and then the call
  throws its usual `Error("Request failed (401)")`.
- The exported types and function signatures for the four calls don't change.

## 3. Web sign-in state (`frontend/apps/web/src/auth/user.ts`)

| Function | Before | After |
|----------|--------|-------|
| `getUser()` | `User` if a username is stored | `User` only if a username **and** a token are stored, otherwise `null` |
| `signIn(username)` → `User` | stores the username | **`signIn(username, password)` → `Promise<User>`**. Requests a token (section 1), then stores `{ username, token }`. Throws on failure and stores nothing. |
| `signOut()` | removes `convai.user` | unchanged. That also removes the token. `convai.sessionIds` stays. |

`User` gains `token: string`. `displayNameFor` is unchanged.

## 4. Sign-in page and app shell

- **`LoginPage`**: `onSignIn` becomes `(username, password) => Promise<void>`. While the
  request is in flight, the button is disabled and reads "Signing in…". If the request fails,
  this message is shown above the button, and the form stays filled in: "Couldn't sign in.
  Check that the local sign-in service is running, then try again."
- **New optional `notice` prop**: shown above the form when set. It is used for "Your session
  has ended. Sign in again."
- **Demo notice text**: "Sign-in uses a local test identity provider. Any username and
  password works." It replaces "Any username and password works. Nothing is checked or sent
  to a server."
- **`App.tsx`**: calls `configureApi({ getToken: () => getUser()?.token ?? null,
  onUnauthorized })`. `onUnauthorized` runs `signOut()`, clears the user and sets the notice
  above.
- **`vite-env.d.ts`**: declares `VITE_OIDC_TOKEN_URL?: string`.

## 5. Test points (web, Vitest)

1. Signing in calls the token endpoint once with `grant_type=password`, the trimmed username
   and `client_id=convai-web`, stores the token, and shows the chat.
2. A failed token request (500, or a network error) keeps the sign-in page, shows the error and
   stores nothing.
3. The button is disabled while the request is in flight.
4. Once signed in, every `/api/*` call carries `Authorization: Bearer <token>`.
5. When any `/api/*` call answers 401, the sign-in page is shown with "Your session has ended.
   Sign in again.", and `getUser()` is `null`.
6. Signing out removes the token. The next sign-in page has no notice.
7. A stored `convai.user` without a `token` (from before this change) shows the sign-in page.
8. The password is never in `localStorage`. This is the existing test, kept.
9. The demo notice shows the new text.
10. `@convai/core`: `configureApi({ baseUrl })` alone still works, and sends no
    `Authorization` header.
