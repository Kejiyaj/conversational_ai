# Research: Chat UI on shadcn AI Elements with Principal Theme

All findings below come from a trial install on a copy of `frontend/` (Nov 4, 2026, shadcn CLI 4.23.0).
The trial built, type-checked and passed all 23 existing frontend tests.

## R1. How shadcn installs into this Vite project

- **Decision**: Add Tailwind CSS v4 through `@tailwindcss/vite`, add the `@/*` alias (tsconfig `paths` and Vite `resolve.alias`), then run `shadcn init -b radix -t vite -p nova`.
- **Rationale**: shadcn requires Tailwind and the `@/` alias before init. `-p nova` is passed to skip the interactive preset prompt; the Principal theme replaces its styling.
- **Findings**:
  - TypeScript 7 removed `baseUrl`. The alias must use `"paths": { "@/*": ["./src/*"] }` alone, otherwise `tsc -b` fails (TS5102).
  - `@types/node` is needed for `node:path` in `vite.config.ts`.
  - Init writes `components.json`, `src/lib/utils.ts`, `src/components/ui/button.tsx`, and adds shadcn's CSS variables to `src/styles.css`.
- **Alternatives considered**: Base UI and React Aria variants (`-b base`, `-b aria`). Radix was chosen by the frontend owner: widest use with shadcn and the most examples.

## R2. Which AI Elements components the chat needs

- **Decision**: `npx shadcn@latest add message-scroller message bubble input-group`.
- **Rationale**: This is the documented "Chat" pattern. It adds `message-scroller`, `message`, `bubble`, `input-group`, plus `input` and `textarea` (used by input-group).
- **Findings**:
  - `MessageScrollerProvider autoScroll` keeps the thread pinned to the newest message; `MessageScrollerButton` is the "scroll to latest" control (FR-003). `scrollAnchor` goes on the user's turn.
  - `Bubble` takes `align="start" | "end"` and variants `default` (primary), `secondary`, `muted`, `tinted`, `outline`, `ghost`, `destructive` (FR-005).
  - `InputGroupTextarea` + `InputGroupButton` form the message box (FR-004). Enter/Shift+Enter handling is ours to write.
  - The components render plain data. The Vercel AI SDK is **not** needed; the existing `api.ts` and backend contract stay as they are (FR-010).
- **Alternatives considered**: AI Elements "Prompt Input" (attachments, model picker). Not needed yet; document upload is out of scope.

## R3. Packages added and whether each is needed

| Package | Added by | Keep? | Why |
|---|---|---|---|
| `tailwindcss`, `@tailwindcss/vite` | us | Yes | Required by shadcn |
| `radix-ui` | init | Yes | Accessible primitives (focus, keyboard, ARIA) for FR-008 |
| `@shadcn/react` | message-scroller | Yes | Scroll-pinning logic behind Message Scroller |
| `class-variance-authority` | init | Yes | Component variants (button, bubble) |
| `cn` | init | Yes | shadcn's own class-merging helper (replaces clsx + tailwind-merge); published by shadcn |
| `lucide-react` | init | Yes | Icons (send, scroll-down) |
| `tw-animate-css` | init | Yes | Small animation utilities used by components |
| `shadcn` | init | Move to devDependencies | Only its `tailwind.css` is imported, at build time; the CLI itself is a dev tool |
| `@fontsource-variable/geist` | nova preset | **Remove** | Principal uses FS Elliot with an Arial fallback; Geist would be off-brand |
| `@types/node` (dev) | us | Yes | Types for `vite.config.ts` |

## R4. Applying the Principal theme

- **Decision**: Put the PDS → shadcn variable mapping in one file, `src/theme/principal.css`, imported by `src/styles.css`. See `contracts/theme-tokens.md`.
- **Rationale**: Every shadcn component reads the same CSS variables (`--primary`, `--border`, `--ring`, `--radius` and so on). Mapping them once restyles everything, including future conversational cards (FR-007, SC-005).
- **Shape**: Principal buttons are pills. shadcn's button base uses `rounded-lg`; we change it to `rounded-full` in `button.tsx` (the file is ours after `add`). The message box uses a 24px radius, not a full pill, so multi-line text still looks right.
- **Font**: Set `--font-sans` to `'FS Elliot Web Regular', Arial, sans-serif`. No font files are shipped (FR-009); visitors without FS Elliot get Arial, as on principal.com.
- **Alternatives considered**: Copying Principal's stylesheets (rejected: FR-009, repo is public); keeping the PDS variable names in components (rejected: shadcn components only read shadcn variable names).

## R5. Sidebar

- **Decision**: Keep the current sidebar structure and its spec 001 behavior, rebuilt with shadcn `Button` (variants `default` for New chat, `ghost` for session items) and Tailwind classes.
- **Rationale**: Meets FR-001/FR-002 with the fewest new parts.
- **Alternatives considered**: shadcn's `sidebar` block. Rejected for now: it pulls in sheet, tooltip, separator, skeleton and a `use-mobile` hook, and would replace spec 001's tested mobile toggle and backdrop. Can be revisited when navigation grows.

## R6. Tests

- **Decision**: Keep Siddesh's tests unchanged (they query by role and text, so they survive the restyle). Add tests for Enter/Shift+Enter, the textarea message box, and a theme test asserting the SC-003 values in `principal.css`.
- **Risk**: Message Scroller may use `ResizeObserver`/`IntersectionObserver`, which jsdom lacks. If tests fail on this, add minimal stubs in the vitest setup file. No network or backend is involved (constitution IV).
