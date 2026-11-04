# Implementation Plan: Chat UI on shadcn AI Elements with Principal Theme

**Branch**: `003-shadcn-ai-elements` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-shadcn-ai-elements/spec.md`

## Summary

Rebuild the chat UI on shadcn (Radix variant) and the AI Elements chat pattern (Message Scroller,
Message, Bubble, Input Group), keeping every behavior from spec 001. Then apply the Principal theme
by mapping Principal Design System values onto shadcn's CSS variables in one file. No backend or
contract changes. A trial install confirmed the approach builds and passes the existing 23 tests
(see [research.md](./research.md)).

## Technical Context

**Language/Version**: TypeScript 7, React 19

**Primary Dependencies**: Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), shadcn 4.23 (Radix, `radix-ui`), `@shadcn/react` (Message Scroller), `class-variance-authority`, `cn`, `lucide-react`, `tw-animate-css`

**Storage**: N/A (no data changes)

**Testing**: Vitest 5 + Testing Library + jsdom (existing), no network

**Target Platform**: Modern desktop and mobile browsers (web only)

**Project Type**: Web application, frontend only

**Performance Goals**: Standard web expectations; production bundle stays in the same order as today (~224 kB JS in the trial)

**Constraints**: Public repo must not contain Principal stylesheets, fonts or logo (FR-009); frontend ↔ backend contract unchanged (FR-010)

**Scale/Scope**: One screen (sidebar + chat), ~7 generated UI components, 2 app components

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Contract-First Interfaces | Pass | No contract change. `api.ts` and README untouched. |
| II. Graceful Agent Degradation | Pass (n/a) | Backend only. The UI keeps showing whatever reply the backend returns, mock or agent. |
| III. Persistence Through Alembic | Pass (n/a) | No schema change. |
| IV. Tests Run Without External Services | Pass | Vitest + jsdom with mocked `fetch`. New tests cover Enter/Shift+Enter, the message box, and theme values. |
| V. POC Simplicity | Pass with justification | New runtime dependencies are justified in Complexity Tracking below. shadcn `sidebar` block and AI SDK deliberately not added. |
| Tech constraints: React + Vite + TS, `/api` proxy | Pass | Unchanged. |

**Post-design re-check**: Pass. Phase 1 design added no new services, contracts or abstractions.

## Project Structure

### Documentation (this feature)

```text
specs/003-shadcn-ai-elements/
├── plan.md              # This file
├── research.md          # Phase 0: trial install findings, decisions
├── data-model.md        # Phase 1: no data changes
├── quickstart.md        # Phase 1: validation guide
├── contracts/
│   └── theme-tokens.md  # Principal → shadcn variable mapping
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

```text
frontend/
├── components.json            # new: shadcn config (radix, css variables)
├── package.json               # new deps (see Complexity Tracking)
├── tsconfig.json              # add "@/*" paths alias
├── vite.config.ts             # add tailwind plugin + "@" alias
└── src/
    ├── styles.css             # Tailwind + shadcn imports; hand-written CSS removed
    ├── theme/
    │   └── principal.css      # new: the only place brand values live
    ├── lib/utils.ts           # new: cn helper (generated)
    ├── components/ui/         # new: generated shadcn files, edited for pill shape/hover
    │   ├── button.tsx
    │   ├── bubble.tsx
    │   ├── message.tsx
    │   ├── message-scroller.tsx
    │   ├── input-group.tsx
    │   ├── input.tsx
    │   └── textarea.tsx
    ├── App.tsx                # chat thread + composer rebuilt on AI Elements
    ├── Sidebar.tsx            # rebuilt on shadcn Button
    ├── api.ts, sessionStore.ts, main.tsx   # unchanged
    └── __tests__/             # existing tests unchanged; new composer + theme tests
```

**Structure Decision**: Frontend-only change inside the existing `frontend/` app. Generated shadcn
components live in `src/components/ui/` (shadcn convention) and are owned by us after generation.
Backend and agent are untouched.

## Implementation phases

1. **Setup**: Tailwind, alias, `shadcn init -b radix -t vite -p nova`, add the four chat components. Remove Geist; move `shadcn` to devDependencies. Gate: build, type-check and existing tests pass.
2. **Story 1 (P1)**: Rebuild `App.tsx` thread and composer with Message Scroller / Message / Bubble / Input Group; rebuild `Sidebar.tsx` with Button; delete the hand-written CSS. Write the Enter/Shift+Enter test first. Gate: all tests pass, manual checks in quickstart Story 1.
3. **Story 2 (P2)**: Add `src/theme/principal.css` per `contracts/theme-tokens.md`; pill buttons and hover color in `button.tsx`; Arial-fallback font. Write the theme-values test first. Gate: tests pass, quickstart Story 2 side-by-side check.

## Complexity Tracking

> New runtime dependencies, justified as required by constitution V.

| Addition | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Tailwind CSS v4 + `@tailwindcss/vite` | shadcn components are styled with Tailwind classes | No shadcn without it; the frontend owner chose shadcn |
| `radix-ui` | Accessible keyboard/focus/ARIA behavior (FR-008) | Hand-rolling accessibility is slower and riskier for a financial-services client |
| `@shadcn/react` | Scroll pinning and "scroll to latest" (FR-003) | Writing our own scroll-follow logic is fiddly and error-prone |
| `class-variance-authority`, `cn` | Variant styling and class merging used by every generated component | Required by the generated code |
| `lucide-react` | Send and scroll-down icons | Inline SVGs would work but would diverge from future shadcn components |
| `tw-animate-css` | Animation utilities referenced by the generated components | Required by the generated code; small |
| `shadcn` (dev only) | Build-time `tailwind.css` import and the CLI for adding later components | n/a, dev dependency |
