# Implementation Plan: Shared UI Library for Web and Mobile

**Branch**: `007-shared-ui-library` | **Date**: 2026-11-05 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/007-shared-ui-library/spec.md`

## Summary

Turn `frontend/` into an npm workspace with two apps and three shared packages. The website moves as it is, and its existing UI components move to `packages/ui`. Only the Button gets a native version, as proof of the approach. Each app imports `@convai/ui/button`, and package `exports` conditions select the platform file. Decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript 7, React 19.3.0 (pinned across the workspace), Node 26

**Primary Dependencies**: Web: Vite 8, Tailwind 4, shadcn, Radix (unchanged). Mobile: Expo SDK 58, React Native 0.88, Uniwind

**Storage**: N/A

**Testing**: Vitest with jsdom for web and packages, `jest-expo` smoke test for mobile, `tsc` in each app, `expo export` as a bundling check

**Target Platform**: Desktop and mobile browsers; iOS and Android through Expo

**Project Type**: Web and mobile frontends with shared packages

**Performance Goals**: No website regression. Compiled website CSS is compared with a baseline from before the move

**Constraints**: No website behaviour or appearance change; no backend, agent or API contract change

**Scale/Scope**: 34 frontend source files move; 1 component gets a native version

## Constitution Check

| Principle | Status | Note |
| --- | --- | --- |
| I. Contract-First Interfaces | Pass | API contract unchanged. The client only gains an optional base location |
| II. Graceful Agent Degradation | N/A | No backend or agent change |
| III. Persistence Through Alembic | N/A | No schema change |
| IV. Tests Without External Services | Pass | All frontend tests run without a backend, simulator or network |
| V. POC Simplicity | Justified | New dependencies and layers are listed below |
| Tech constraint: frontend in `frontend/`, Vite, relative `/api` | Justified | Website complies. The mobile app cannot use a relative path, see below |

Post-design re-check: no new violations.

## Project Structure

### Documentation (this feature)

```text
specs/007-shared-ui-library/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── package-layout.md
│   └── button-api.md
└── tasks.md
```

### Source Code

```text
frontend/
├── package.json            # Workspace root: install, test and build everything
├── apps/
│   ├── web/                # The website (Vite)
│   │   └── src/            # App, Sidebar, FeedbackBar, Logo, markdown, sessionStore, colorScheme, tests
│   └── mobile/             # The mobile app (Expo)
│       └── src/            # App (starter screen), global.css, tests
└── packages/
    ├── ui/                 # @convai/ui: shared components
    │   └── src/
    │       ├── button/     # button.types.ts, button.web.tsx, button.native.tsx
    │       └── web/        # Web-only components, until each is ported
    ├── core/               # @convai/core: API client, types, text parsing
    │   └── src/
    └── tokens/             # @convai/tokens: brand values
        ├── tokens.json     # The only place to edit brand values
        ├── generate.mjs    # Writes the two CSS files below
        └── generated/      # principal.css (web), uniwind.css (mobile)
```

**Structure Decision**: Apps run things and packages share things. Apps can import packages, and packages never import apps. See [contracts/package-layout.md](contracts/package-layout.md).

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| Mobile cannot use the relative `/api` path | A native app has no page origin | Hard-coding a URL in the client would break the website's relative path |
| New runtime dependencies: Expo, React Native, Uniwind | Required by the product owner's choice of Expo, and Uniwind is the stable Tailwind 4 option | NativeWind stable predates Tailwind 4 support |
| Workspace with three packages | Explicit requirement, separates shared code by purpose | One shared package would mix tokens, logic and components |
| Token generator script | Web and Uniwind need different CSS formats from one source | Style Dictionary adds a dependency for two small outputs; hand-synced files break FR-009 |
| React pinned from 19.3.1 to 19.3.0 | Expo SDK 58 pins this exact version, and two copies cause runtime errors | Separate React copies per app are the failure the spec warns about |

The constitution names only `frontend/`, Vite and the relative path. Its wording should be amended by a separate PR with component-owner approval, as its governance section requires.
