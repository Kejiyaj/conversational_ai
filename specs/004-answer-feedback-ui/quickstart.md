# Quickstart: validate spec 004

## Prerequisites

- Backend from `main` (spec 002 merged) running on `:8000` with Postgres; frontend `npm install` in `frontend/`.

## Automated

```bash
cd frontend
npx tsc -b && npm test && npm run build
```

## Manual

1. Send a message. Under the reply: "Helpful" and "Not helpful" controls, unselected. None under your own message.
2. Tap "Helpful". It shows as selected. Check the stored row:
   `docker exec convai-db psql -U app -d convai -c "select message_id, rating, reason, comment from feedback order by updated_at desc limit 3"`
3. On another reply tap "Not helpful". The follow-up shows four reasons and a comment box with a character counter. Pick "Unclear", type a comment, Send. The row shows `down | unclear | <comment>`.
4. Tap "Helpful" on that reply. The row shows `up | (null) | <comment>`.
5. Open another chat and come back: ratings are still shown. Reload the page: they are not (known limitation).
6. Stop the backend and tap a thumb: "Couldn't save your feedback" with Retry, controls unchanged. Start the backend, Retry: saved.
7. Tab to the controls: each has a visible focus ring; arrow keys move between reasons.
