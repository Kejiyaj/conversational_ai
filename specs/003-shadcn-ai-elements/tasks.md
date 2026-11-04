---

description: "Task list for spec 003: chat UI on shadcn AI Elements with Principal theme"
---

# Tasks: Chat UI on shadcn AI Elements with Principal Theme

**Input**: Design documents from `/specs/003-shadcn-ai-elements/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/theme-tokens.md, quickstart.md

**Tests**: Required. Constitution IV requires a test for each behavior in the spec, and the plan says to write tests first. Existing tests in `frontend/src/__tests__/` MUST NOT be edited (SC-001).

**Organization**: Tasks are grouped by user story so each can be implemented and tested on its own.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2)
- All paths are relative to the repository root

## Rule for every task: keep the test hooks

The existing tests find elements by these hooks. Each rebuilt element MUST keep them, next to any Tailwind classes:

- Class `layout` on the root, plus `open` while the narrow-screen sidebar is open
- Class `backdrop` on the tap-outside overlay, rendered only while open
- Class `message` on each message element, whose text content is exactly the message text
- Class `pending` on the waiting indicator, rendered only while a reply is pending
- Class `session-title` on each session title; a `<time dateTime=…>` inside each session item
- Placeholder text `Type a message` on the message box
- Accessible button names `Send`, `Chats`, `New chat`, `Retry` (use `aria-label="Send"` if Send becomes an icon button)
- `role="navigation"` (the `<nav aria-label="Past chats">`), `role="alert"` on sidebar errors, `aria-current="true"` on the active session

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install Tailwind and shadcn (Radix) with the chat components. Steps and pitfalls are in research.md R1–R3.

- [ ] T001 Install `tailwindcss` and `@tailwindcss/vite` as dependencies and `@types/node` as a devDependency in `frontend/package.json` (run `npm install` in `frontend/`)
- [ ] T002 Add the Tailwind plugin and the `@` alias (`resolve: { alias: { "@": path.resolve(__dirname, "./src") } }`, `import path from "node:path"`) in `frontend/vite.config.ts`; keep the existing `/api` proxy and `test: { environment: "jsdom" }`
- [ ] T003 Add `"paths": { "@/*": ["./src/*"] }` to `compilerOptions` in `frontend/tsconfig.json`. Do NOT add `baseUrl`: TypeScript 7 rejects it (TS5102)
- [ ] T004 Add `@import "tailwindcss";` as the first line of `frontend/src/styles.css`
- [ ] T005 Run `npx shadcn@latest init -b radix -t vite -p nova -y </dev/null` in `frontend/`; confirm it creates `frontend/components.json`, `frontend/src/lib/utils.ts`, `frontend/src/components/ui/button.tsx` and adds shadcn variables to `frontend/src/styles.css`
- [ ] T006 Run `npx shadcn@latest add message-scroller message bubble input-group -y </dev/null` in `frontend/`; confirm it creates `message.tsx`, `bubble.tsx`, `message-scroller.tsx`, `input-group.tsx`, `input.tsx`, `textarea.tsx` in `frontend/src/components/ui/`
- [ ] T007 Remove Geist: uninstall `@fontsource-variable/geist` and delete its `@import` from `frontend/src/styles.css`. Move `shadcn` from dependencies to devDependencies in `frontend/package.json` (research R3)
- [ ] T008 Verify in `frontend/`: `npx tsc -b`, `npm test` (all 23 existing tests pass), `npm run build`. Stop and fix before continuing

**Checkpoint**: shadcn is installed; the old UI still looks and works as before.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Test setup that both stories need.

- [ ] T009 If `npm test` fails in later phases with `ResizeObserver` or `IntersectionObserver` not defined, add minimal no-op stubs in a new `frontend/src/__tests__/setup.ts` and register it with `test.setupFiles` in `frontend/vite.config.ts` (research R6). Otherwise skip and mark done with a note

**Checkpoint**: Foundation ready; user stories can start.

---

## Phase 3: User Story 1 - Same chat, rebuilt on the new component kit (Priority: P1) 🎯 MVP

**Goal**: The chat thread, message box and sidebar use shadcn/AI Elements with every spec 001 behavior kept, plus pinned scrolling, a "scroll to latest" control and an auto-growing message box.

**Independent Test**: All existing tests plus the new US1 tests pass; quickstart.md "Manual (User Story 1)" steps 1–8 work.

### Tests for User Story 1 (write first, confirm they FAIL)

- [ ] T010 [US1] Create `frontend/src/__tests__/Composer.test.tsx` using the existing `frontend/src/__tests__/helpers.ts` fetch mocks. Cases: (a) pressing Enter in the "Type a message" box sends the message (the user message appears in `.message` elements and `/api/chat` is called once); (b) Shift+Enter does not send and the box still holds the text; (c) Enter on empty or whitespace-only input sends nothing; (d) the message box is a multi-line `textarea`; (e) Send is disabled while a reply is pending; (f) a failed send shows "Something went wrong." as an assistant message
- [ ] T011 [US1] Run `npm test` in `frontend/`; confirm T010 cases (a), (b) and (d) fail on the old UI and all existing tests still pass

### Implementation for User Story 1

- [ ] T012 [US1] Add `failed?: boolean` to the frontend `Message` type in `frontend/src/App.tsx` and set it on the "Something went wrong." reply only (data-model.md). Not stored or sent
- [ ] T013 [US1] Rebuild the thread in `frontend/src/App.tsx` with `MessageScrollerProvider autoScroll` > `MessageScroller` > `MessageScrollerViewport` > `MessageScrollerContent` > `MessageScrollerItem` (add `scrollAnchor` on user turns) > `Message align` > `MessageContent` > `Bubble` > `BubbleContent`, plus `MessageScrollerButton` for "scroll to latest". User turns: `align="end"`, `variant="default"`; assistant: `align="start"`, `variant="secondary"`; failed reply: `variant="destructive"`. Put class `message` on the element whose text is exactly the message text. Keep the `.pending` indicator inside the scroller
- [ ] T014 [US1] Rebuild the composer in `frontend/src/App.tsx` with `InputGroup` + `InputGroupTextarea` (placeholder "Type a message") + `InputGroupButton` (accessible name "Send", lucide `ArrowUp` or `Send` icon). Enter submits, Shift+Enter inserts a newline, the textarea grows with content up to a max height (for example `max-h-40`), Send is disabled while pending. Keep the existing `send` logic and its stale-reply guards unchanged
- [ ] T015 [US1] Rebuild the layout and header in `frontend/src/App.tsx` with Tailwind classes: full-height flex layout (`layout`, `open` hooks), sidebar column, `backdrop` overlay on narrow screens (below 768px), "Chats" toggle as a shadcn `Button variant="ghost"` with `aria-expanded`, `<h1>Conversational AI</h1>`
- [ ] T016 [P] [US1] Rebuild `frontend/src/Sidebar.tsx` with shadcn `Button`: "New chat" `variant="default"`; each session item `variant="ghost"`, full width, left-aligned, two lines (`session-title` span and `<time>`), `aria-current` on the active one with a visible active style; error box with `role="alert"` and a "Retry" `Button variant="outline" size="sm"`; empty state "No past chats yet." Props and behavior unchanged
- [ ] T017 [US1] Delete the hand-written rules (`.layout`, `.sidebar*`, `.session-*`, `.chat*`, `.messages`, `.message*`, `.composer`, `.pending`, `.backdrop`, `.chats-toggle`, `.new-chat`) from `frontend/src/styles.css`, keeping only the Tailwind/shadcn imports, the shadcn variable blocks and any rule still needed for the narrow-screen layout. The hook class names stay in the JSX
- [ ] T018 [US1] Make long unbroken text (for example a pasted URL) wrap inside its bubble without widening the page: check `BubbleContent` keeps `wrap-break-word` and `min-w-0` in `frontend/src/components/ui/bubble.tsx` (spec edge case)
- [ ] T019 [US1] Run `npx tsc -b`, `npm test` and `npm run build` in `frontend/`. All existing tests and T010 pass with no edits to existing test files

**Checkpoint**: User Story 1 is complete. The UI runs on shadcn/AI Elements with the default (neutral) theme.

---

## Phase 4: User Story 2 - Principal look and feel (Priority: P2)

**Goal**: Apply Principal brand values through shadcn variables in one file.

**Independent Test**: The US2 theme test passes; quickstart.md "Manual (User Story 2)" side-by-side check against principal.com matches.

### Tests for User Story 2 (write first, confirm they FAIL)

- [ ] T020 [US2] Create `frontend/src/__tests__/theme.test.ts` that reads `frontend/src/theme/principal.css` as text (`node:fs`) and asserts the SC-003 values from `specs/003-shadcn-ai-elements/contracts/theme-tokens.md`: `--primary: #005fb8`, `--foreground: #2f2f2f`, `--ring: #3871ff`, `--radius: 1.5rem`, `--secondary: #e3f5fd`. Also assert that no other file under `frontend/src/` (except `theme/` and `__tests__/`) contains `#005fb8` or `#002855`, so brand colors live in one place (FR-007, SC-005)
- [ ] T021 [US2] Run `npm test` in `frontend/`; confirm T020 fails because `principal.css` does not exist yet

### Implementation for User Story 2

- [ ] T022 [US2] Create `frontend/src/theme/principal.css` with a `:root` block holding every value in the mapping table of `specs/003-shadcn-ai-elements/contracts/theme-tokens.md` (background, foreground, card, popover, primary, primary-hover, secondary, muted, accent, destructive, border, input, ring, radius, all sidebar variables). Add a header comment naming PDS on principal.com as the source and stating that no Principal stylesheets, fonts or logo are included (FR-009)
- [ ] T023 [US2] In `frontend/src/styles.css`, delete the shadcn default `:root` values and the `.dark` block (light mode only), import `./theme/principal.css` after the shadcn imports, and set `--font-sans: 'FS Elliot Web Regular', Arial, sans-serif` (and `--font-heading: var(--font-sans)`) in the `@theme inline` block. Set `body` color to `var(--foreground)` with comfortable line height (`leading-relaxed`, 16px base)
- [ ] T024 [P] [US2] In `frontend/src/components/ui/button.tsx`: change the base `rounded-lg` to `rounded-full` (pill), and change the `default` variant hover from `hover:bg-primary/80` to `hover:bg-(--primary-hover)`. The `--primary-hover: #004c97` value is defined in `frontend/src/theme/principal.css` (T022), so no brand value is hard-coded in the component
- [ ] T025 [P] [US2] In `frontend/src/components/ui/input-group.tsx`: use a 24px radius (`rounded-3xl`) on the `InputGroup` root instead of `rounded-lg`, so the message box matches Principal's rounded inputs while still fitting multi-line text
- [ ] T026 [US2] Check focus styling: every interactive control (Send, New chat, session items, Retry, Chats, scroll-to-latest, message box) shows the `--ring` color on keyboard focus. Fix any control in `frontend/src/App.tsx` or `frontend/src/Sidebar.tsx` that does not (FR-008, SC-004)
- [ ] T027 [US2] Run `npx tsc -b`, `npm test` and `npm run build` in `frontend/`; all tests pass, including T020

**Checkpoint**: Both stories complete. The chat matches the Principal look.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T028 [P] Update the frontend section of `README.md`: shadcn (Radix) + AI Elements, how to add a component (`npx shadcn@latest add <name>`), and that brand values live only in `frontend/src/theme/principal.css`. The API contract section stays unchanged
- [ ] T029 [P] Confirm FR-009: `git diff main --stat` shows no Principal stylesheet, font file or logo, and `frontend/src/theme/principal.css` contains only variable values
- [ ] T030 Run every step in `specs/003-shadcn-ai-elements/quickstart.md` (automated and manual, with the backend on `:8000`) and record any deviation in this file under a "Notes" heading

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002–T004 → T005 → T006 → T007 → T008, strictly in order
- **Foundational (Phase 2)**: depends on Setup; T009 only if needed
- **User Story 1 (Phase 3)**: depends on Phase 2
- **User Story 2 (Phase 4)**: depends on US1 (the theme is applied to the rebuilt components; spec: "It depends on Story 1 being in place")
- **Polish (Phase 5)**: depends on US1 and US2

### Within Each User Story

- Tests first (T010–T011, T020–T021), confirmed failing
- US1: T012 → T013 → T014 → T015 (all in `App.tsx`); T016 in parallel with T012–T015; then T017 → T018 → T019
- US2: T022 → T023; T024 and T025 in parallel after T022; then T026 → T027

### Parallel Opportunities

- T016 (`Sidebar.tsx`) alongside T012–T015 (`App.tsx`)
- T024 (`button.tsx`) alongside T025 (`input-group.tsx`)
- T028 and T029 alongside each other

## Parallel Example: User Story 1

```text
Developer A: T012 → T013 → T014 → T015 in frontend/src/App.tsx
Developer B: T016 in frontend/src/Sidebar.tsx
Then: T017 → T018 → T019
```

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup and Phase 2 Foundational
2. Phase 3 (US1): **stop and validate** with the full test suite and quickstart Story 1
3. Commit; the UI now runs on the new kit with neutral styling

### Incremental Delivery

1. Setup + Foundational → kit installed, nothing visible changes
2. US1 → rebuilt chat, same behavior, better scrolling and message box (commit)
3. US2 → Principal theme (commit)
4. Polish → README, FR-009 check, full quickstart run (commit, open PR to `main`)
