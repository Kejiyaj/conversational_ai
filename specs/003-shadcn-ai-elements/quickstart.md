# Quickstart: validate spec 003

## Prerequisites

- Node 22+, from `frontend/`: `npm install`
- For manual checks: the backend running on `:8000` (see `README.md`). Mock replies are fine.

## Automated

```bash
cd frontend
npx tsc -b        # type-check passes
npm test          # all existing spec 001 tests plus the new spec 003 tests pass
npm run build     # production build succeeds
```

## Manual (User Story 1: nothing lost)

1. `npm run dev`, open http://localhost:5173.
2. Send a message. Your message appears on the right; "…" shows; Send is disabled; the reply appears on the left.
3. Press Shift+Enter in the message box: a new line is added. Press Enter: the message is sent.
4. Send enough messages to overflow. The view stays on the newest. Scroll up: a "scroll to latest" button appears and takes you back.
5. Click "New chat", then reopen the previous chat from the sidebar. Its history loads and it is marked current.
6. Stop the backend and reload. The sidebar shows an error with Retry. Start the backend and click Retry.
7. Narrow the window below 768px. "Chats" opens the sidebar; clicking outside closes it.
8. Paste a long URL with no spaces. It wraps inside the bubble.

## Manual (User Story 2: Principal theme)

Open https://www.principal.com side by side and compare against `contracts/theme-tokens.md`:

- Send and New chat are Principal blue `#005fb8`, darken on hover, pill-shaped.
- Body text is `#2f2f2f`; your bubbles are blue with white text; replies are light blue with navy text.
- Tab through the page: every control shows the `#3871ff` focus ring.
- Change `--primary` in `src/theme/principal.css`: every primary element updates (SC-005).
