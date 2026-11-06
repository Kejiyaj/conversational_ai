# Feature Specification: Shared UI Library for Web and Mobile

**Feature Branch**: `007-shared-ui-library`

**Created**: 2026-11-05

**Status**: Draft

**Input**: User description: "Shared UI library for the web site and a React Native (Expo) mobile app, using the shared component API, platform-specific files approach. Restructure frontend/ into frontend/apps/web, frontend/apps/mobile and frontend/packages (ui, core, tokens). The website must keep working with all existing tests passing, and the folder structure must make it obvious what lives where. Mobile scope for this feature: the app starts, uses the shared tokens and core, and renders the shared Button; the full native chat screen is a later feature. Docs and tooling paths that reference frontend/ are updated."

## User Scenarios & Testing *(mandatory)*

The users of this feature are the developers working on the frontend. Website visitors must notice no change.

### User Story 1 - Website keeps working from its new location (Priority: P1)

A developer runs, tests and builds the website from its own folder, and website visitors see exactly what they saw before.

**Why this priority**: The website is the only live product. The restructure has no value if it puts the website at risk.

**Independent Test**: Run the existing website test suite and production build from the new location, then use the chat in a browser.

**Acceptance Scenarios**:

1. **Given** the restructured frontend, **When** a developer runs the website tests, **Then** every test that passed before the move still passes, with no test removed or weakened.
2. **Given** the restructured frontend, **When** a developer starts the website, **Then** chat, past chats, feedback, and light and dark themes behave as before.
3. **Given** the restructured frontend, **When** a developer runs the production build, **Then** it completes without type or build errors.

---

### User Story 2 - Clear folder structure (Priority: P1)

A developer new to the repository can tell from the folder names where website code, mobile code and shared code live, and where a new piece of code belongs.

**Why this priority**: The structure is an explicit goal of this work, and every later feature builds on it.

**Independent Test**: Follow the README's structure section to locate each listed area without searching the code.

**Acceptance Scenarios**:

1. **Given** the frontend folder, **When** a developer opens it, **Then** the website, the mobile app and each shared package are in separate, clearly named folders.
2. **Given** the README, **When** a developer reads the frontend section, **Then** it states what each folder holds and how to run and test it.
3. **Given** a shared package, **When** its code is checked, **Then** it does not import from either app.

---

### User Story 3 - One Button, two platforms (Priority: P2)

A developer uses the shared Button with the same import and the same options in both apps, and each app gets the implementation for its own platform.

**Why this priority**: This proves the chosen approach end to end on one component, before more components are ported.

**Independent Test**: Use the Button with the same variant and size in both apps and confirm each renders correctly, with a type check rejecting an unknown variant in either app.

**Acceptance Scenarios**:

1. **Given** the shared Button, **When** it is imported in either app, **Then** the import path and supported options are the same.
2. **Given** a Button option that is not part of the shared definition, **When** it is used in either app, **Then** the type check fails.
3. **Given** the website, **When** the Button is displayed, **Then** it looks and behaves as it did before this feature.

---

### User Story 4 - Mobile app starts on shared foundations (Priority: P2)

A developer starts the mobile app and sees a starter screen that uses the shared brand colours, the shared Button and shared logic.

**Why this priority**: It shows that shared code runs on a device, which is the riskiest assumption behind the approach. The full chat screen is a later feature.

**Independent Test**: Start the mobile app on a simulator or device and check the starter screen in light and dark system settings.

**Acceptance Scenarios**:

1. **Given** the restructured frontend, **When** a developer starts the mobile app, **Then** a starter screen opens without errors.
2. **Given** the starter screen, **When** the system theme is light or dark, **Then** the screen uses the matching shared brand palette.
3. **Given** the starter screen, **When** it is displayed, **Then** it includes the shared Button and output from shared logic.

---

### User Story 5 - One source of brand values (Priority: P3)

A developer changes a brand colour in one place, and both apps pick it up.

**Why this priority**: Keeping the brand consistent is a main reason for sharing, but it can follow once the structure and Button work.

**Independent Test**: Change one token value, then confirm both apps show the new value and no other file needed editing.

**Acceptance Scenarios**:

1. **Given** the shared tokens, **When** a brand value changes, **Then** both apps use the new value with no other source edit.
2. **Given** the source files outside the token package, **When** the existing brand check runs, **Then** it finds no hard-coded brand colours.

### Edge Cases

- A web-only shared component is imported in the mobile app: the failure must be visible during development, never a silent blank screen.
- The mobile app has no web page origin, so a relative API path cannot work: the API location must be configurable, and the website's default must stay the relative `/api` path.
- The two apps must not load two copies of the UI runtime, which causes runtime errors.
- Existing tests rely on CSS class hooks and on reading the theme file: these must keep working after the move.
- Developers have an existing install in the old location: the README must state the new install step.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST be organised as one workspace with one install step, containing `apps/web`, `apps/mobile`, `packages/ui`, `packages/core` and `packages/tokens`.
- **FR-002**: All existing website code MUST move to either `apps/web` or a shared package, with imports updated and git history preserved through moves where practical.
- **FR-003**: Website behaviour and appearance MUST NOT change.
- **FR-004**: All existing website tests MUST continue to pass, changed only for file locations and imports.
- **FR-005**: `packages/ui` MUST expose each component through one import path, and MUST hold the existing website UI components.
- **FR-006**: The Button MUST have one shared definition of its options, a web implementation built from the existing Button, and a native implementation. Other components stay web-only in this feature.
- **FR-007**: `packages/core` MUST hold platform-independent code: API types, the API client and pure text parsing.
- **FR-008**: The API client MUST allow its base location to be set by each app. The website MUST keep using the relative `/api` path.
- **FR-009**: `packages/tokens` MUST be the only source of brand values, covering light and dark palettes, and both apps MUST consume it.
- **FR-010**: `apps/mobile` MUST start on a simulator or device and show a starter screen with the shared Button, shared tokens and shared logic, following the system light or dark setting.
- **FR-011**: Shared packages MUST NOT import from either app.
- **FR-012**: The README, project configuration and tooling paths that reference the old frontend locations MUST be updated in the same change, including new run and test instructions for each folder.
- **FR-013**: Backend and agent code and the API contract MUST NOT change.

### Key Entities

- **App**: A runnable product (website, mobile app). It depends on packages and owns its platform services and screens.
- **Package**: Shared code with one purpose (ui, core, tokens). It never depends on an app.
- **Component API**: The shared definition of a component's options, which every platform implementation must satisfy.
- **Design token**: A named brand value with a light and a dark version.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the website tests that passed before the move pass after it, and the same number of tests runs.
- **SC-002**: A new developer can name the correct folder for website, mobile and shared code in under 2 minutes using the README.
- **SC-003**: A change to one brand value requires editing exactly one source file.
- **SC-004**: A developer can install once and start either app using only the README's commands.
- **SC-005**: No file in a shared package imports from an app, and an automated check confirms this.
- **SC-006**: A manual pass through the website's chat, past chats, feedback and theme shows no visible difference from before the move.

## Assumptions

- The mobile app uses React Native with Expo, as confirmed by the product owner.
- The website stays on its current build tool and component kit.
- This feature ports only the Button to native. Other native components and the chat screen are later features.
- `App.tsx` logic is not moved into shared hooks in this feature. That happens when the native chat screen needs it, which keeps this change small.
- Session storage and colour scheme code stay in the website for now, because they are platform-specific and the mobile app does not need them yet.
- Mobile sign-in, chat history across devices and app store release are out of scope.
- Verifying the mobile app on a physical device or simulator depends on the developer's machine having the necessary tools.
