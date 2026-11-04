# Implementation Plan: Answer Feedback in the Chat UI

**Branch**: `004-answer-feedback-ui` | **Date**: 2026-11-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-answer-feedback-ui/spec.md`

## Summary

Add thumbs up/down under each assistant reply, an optional reason and comment follow-up, and
re-rating, using the spec 002 backend as-is. The UI keeps the full feedback state per reply and
always sends all of it, because the backend replaces the whole record on each call
([research.md](./research.md) R1). Ratings are kept in memory for the visit.

## Technical Context

**Language/Version**: TypeScript 7, React 19

**Primary Dependencies**: Existing spec 003 stack (shadcn Radix, AI Elements, Tailwind v4, lucide-react). Adds shadcn `toggle` + `toggle-group` source files; no new npm packages.

**Storage**: N/A in the frontend (in-memory for the visit). Backend `feedback` table from spec 002, unchanged.

**Testing**: Vitest + Testing Library + jsdom, fetch mocked by the shared fake backend in `src/__tests__/helpers.ts`

**Target Platform**: Modern desktop and mobile browsers

**Project Type**: Web application, frontend only

**Performance Goals**: Rating confirmed on screen within 1 s under normal conditions (SC-001)

**Constraints**: No contract change (FR-014); screen must match stored state (SC-003)

**Scale/Scope**: One new component (feedback bar + follow-up), small changes to `App.tsx` and `api.ts`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|---|---|---|
| I. Contract-First Interfaces | Pass | Uses spec 002's additive `message_id` and feedback endpoint; no change. `api.ts` type gains `message_id`, matching the contract. |
| II. Graceful Agent Degradation | Pass (n/a) | Mock replies are rateable, as spec 002 FR-009 requires. |
| III. Persistence Through Alembic | Pass (n/a) | No schema change. |
| IV. Tests Run Without External Services | Pass | Fake backend gains the feedback endpoint; every behavior and edge case gets a test. |
| V. POC Simplicity | Pass | No new npm packages; no new services. Visit-only memory instead of storage. |

**Post-design re-check**: Pass.

## Project Structure

### Documentation (this feature)

```text
specs/004-answer-feedback-ui/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/frontend-api.md
└── tasks.md             # /speckit-tasks
```

### Source Code (repository root)

```text
frontend/src/
├── api.ts                         # + message_id on ChatResponse, Feedback types, submitFeedback()
├── App.tsx                        # Message.id; feedback map for the visit; render <FeedbackBar> in MessageFooter
├── FeedbackBar.tsx                # new: thumbs, follow-up (reasons + comment), error + Retry
├── components/ui/toggle.tsx       # new (shadcn add toggle-group)
├── components/ui/toggle-group.tsx # new
└── __tests__/
    ├── helpers.ts                 # additive: message_id in chat reply, feedback endpoint, failFeedback switch
    └── Feedback.test.tsx          # new
```

**Structure Decision**: Frontend only. A single `FeedbackBar` component owns the controls and
follow-up for one reply; `App` owns the per-visit map so state survives chat switches.

## Implementation phases

1. **Setup**: `npx shadcn@latest add toggle-group`; extend `api.ts`; extend the test fake backend.
2. **Story 1 (P1)**: tests first; `Message.id` from chat reply and history; `FeedbackBar` thumbs with `aria-pressed`, saving/disabled, error + Retry; visit map in `App`.
3. **Story 2 (P2)**: tests first; follow-up panel: reason toggle group (down only), comment with 1000 limit and counter, Send, dismiss, thank-you.
4. **Story 3 (P3)**: tests first; switching rating replaces state, clears reason on "up", same-thumb is a no-op.
5. **Polish**: README note, quickstart run including the database check.

## Complexity Tracking

No constitution violations; no new runtime dependencies.
