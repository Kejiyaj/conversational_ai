# Tasks: Shared UI Library for Web and Mobile

**Input**: Design documents from `/specs/007-shared-ui-library/`

**Tests**: Existing website tests are the safety net. New tests cover the behaviour this feature adds (constitution IV).

All paths are relative to `frontend/` unless they start with a repo folder.

## Phase 1: Setup

- [X] T001 Record the baseline before moving anything: test count, and the compiled CSS and JS sizes, from `npm test` and `npm run build` in `frontend/`, saved to the session scratchpad
- [X] T002 Create the folders `apps/web`, `apps/mobile`, `packages/ui`, `packages/core` and `packages/tokens`

## Phase 2: Foundational

- [X] T003 Create the workspace root in `package.json` with workspaces, React 19.3.0 `overrides`, and `test`, `build`, `web`, `mobile`, `tokens` and `bundle:mobile` scripts
- [X] T004 Create package manifests with `exports` per `specs/007-shared-ui-library/contracts/package-layout.md` in `packages/ui/package.json`, `packages/core/package.json` and `packages/tokens/package.json`

## Phase 3: User Stories 1 and 2 - Website moves, structure is clear (P1)

**Goal**: The website runs from `apps/web` and shared code sits in named packages, with no behaviour change.

**Independent Test**: The website test count matches the baseline, the build passes, and compiled CSS matches the baseline.

- [X] T005 [US1] Move the website with `git mv`: `index.html`, `vite.config.ts`, `tsconfig.json` and `src/` to `apps/web/`, and create `apps/web/package.json`
- [X] T006 [US1] Move `src/components/ui/*.tsx` to `packages/ui/src/web/`, and `src/lib/utils.ts` to `packages/ui/src/lib/utils.ts`
- [X] T007 [US1] Move `components.json` to `packages/ui/components.json` and add `packages/ui/tsconfig.json`, so `npx shadcn add` writes to `packages/ui/src/web/`
- [X] T008 [US1] Move `api.ts` and `messageText.ts` to `packages/core/src/`, split the parser from `apps/web/src/markdown.tsx` into `packages/core/src/markdown.ts`, and export them from `packages/core/src/index.ts`
- [X] T009 [US1] Move `apps/web/src/__tests__/messageText.test.ts` to `packages/core/src/__tests__/messageText.test.ts`, and add `packages/core/vitest.config.ts`
- [X] T010 [US1] Update imports to `@convai/ui/*` and `@convai/core` in `apps/web/src/` and `packages/ui/src/web/`
- [X] T011 [US1] Add `@source` for `packages/ui/src`, excluding `*.native.tsx`, in `apps/web/src/styles.css`
- [X] T012 [US1] Write a failing test, then add `configureApi({ baseUrl })` with a default of the relative path, in `packages/core/src/__tests__/api.test.ts` and `packages/core/src/api.ts`
- [X] T013 [US2] Add the package boundary test in `apps/web/src/__tests__/packageBoundaries.test.ts`, and extend the brand check in `apps/web/src/__tests__/theme.test.ts` to cover `packages/ui` and `packages/core`
- [X] T014 [US1] Run all tests and the build, then compare results with the T001 baseline

## Phase 4: User Story 3 - One Button, two platforms (P2)

**Goal**: `@convai/ui/button` resolves per platform with one shared set of options.

**Independent Test**: An unknown variant fails the type check in both apps, and the website's compiled CSS still matches the baseline.

- [X] T015 [US3] Define the shared options per `specs/007-shared-ui-library/contracts/button-api.md` in `packages/ui/src/button/button.types.ts`
- [X] T016 [US3] Move `packages/ui/src/web/button.tsx` to `packages/ui/src/button/button.web.tsx`, using the shared types without changing its classes
- [X] T017 [US3] Write `packages/ui/src/button/button.native.tsx` from the React Native Reusables Button, with `Record` tables over the shared variant and size types
- [X] T018 [US3] Add the `./button` export with `react-native` and `default` conditions in `packages/ui/package.json`

## Phase 5: User Story 5 - One source of brand values (P3)

Done before User Story 4 because the mobile app needs the tokens.

**Goal**: Editing `tokens.json` updates both apps.

**Independent Test**: A stale generated file fails `npm test`, and regenerating produces no change to the website theme values.

- [X] T019 [US5] Create `packages/tokens/tokens.json` from `apps/web/src/theme/principal.css`. `dark` "must define every colour token in `light`"
- [X] T020 [US5] Write the failing test for generated output and staleness in `packages/tokens/generate.test.mjs`
- [X] T021 [US5] Write `packages/tokens/generate.mjs`, producing `packages/tokens/generated/principal.css` and `packages/tokens/generated/uniwind.css`
- [X] T022 [US5] Remove `apps/web/src/theme/principal.css`, and point `apps/web/src/styles.css`, `apps/web/src/__tests__/theme.test.ts` and `apps/web/vite.config.ts` at `@convai/tokens/principal.css`

## Phase 6: User Story 4 - Mobile app starts on shared foundations (P2)

**Goal**: The Expo app starts and shows the shared Button, tokens and logic.

**Independent Test**: The mobile tests, type check and iOS and Android bundles pass without a simulator.

- [X] T023 [US4] Create the Expo app config in `apps/mobile/package.json`, `apps/mobile/app.json`, `apps/mobile/index.ts`, `apps/mobile/babel.config.js`, `apps/mobile/metro.config.js` and `apps/mobile/tsconfig.json` with `customConditions: ["react-native"]`
- [X] T024 [US4] Create `apps/mobile/src/global.css` with Tailwind, Uniwind, `@convai/tokens/uniwind.css` and `@source` entries
- [X] T025 [US4] Write a failing smoke test in `apps/mobile/src/__tests__/App.test.tsx`, then create the starter screen in `apps/mobile/src/App.tsx`
- [X] T026 [US4] Confirm the failure checks in `specs/007-shared-ui-library/quickstart.md`: web-only import and unknown variant fail in `apps/mobile`
- [X] T027 [US4] Run `npm run bundle:mobile` for iOS and Android

## Phase 7: Polish

- [X] T028 Update the structure, run, test and UI kit sections in `README.md` (repo root)
- [X] T029 Update the token and component paths in `.pdlc/config.yaml` (repo root), and add mobile output folders to `.gitignore` (repo root)
- [ ] T030 Run the full quickstart, including a website check in a browser and a mobile simulator check if available, and report anything that could not run

## Dependencies

- Phases 1 and 2 come first.
- Phase 3 (website move) blocks all later phases.
- User Story 3 and User Story 5 are independent of each other.
- User Story 4 depends on User Stories 3 and 5.

No tasks are marked parallel, because most touch the same moved files.

## Implementation Strategy

Phase 3 is the MVP: the website is safe in its new structure, and it could merge alone. Each later phase ends with all tests passing.
