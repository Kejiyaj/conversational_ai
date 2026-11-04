# Data Model: Chat UI on shadcn AI Elements with Principal Theme

This feature adds no data. No backend entities, database tables or API fields change.

The frontend keeps its existing view state from spec 001 (`activeSessionId`, `messages`, `pending`,
`sessions`, sidebar error and open state). One small addition:

- **Message (frontend view only)**: `{ role: "user" | "assistant", text: string, failed?: boolean }`.
  `failed` is set on the "Something went wrong." reply so it can be shown with the error style.
  It is not stored or sent anywhere.
