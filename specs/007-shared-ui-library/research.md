# Research: Shared UI Library for Web and Mobile

Checked on 2026-11-05 against npm and project docs.

## R1. Workspace tool

- **Decision**: npm workspaces, with the root at `frontend/`.
- **Rationale**: The repo already uses npm, and [Expo supports npm workspaces](https://docs.expo.dev/guides/monorepos/) with automatic Metro setup since SDK 52. `cd frontend && npm test` and `npm run build` keep working, so `.pdlc/config.yaml` commands stay valid.
- **Alternatives considered**: pnpm, Turborepo and Nx add tooling this size of project does not need.

## R2. Selecting the platform file

- **Decision**: Package `exports` conditions: `react-native` selects the native file and `default` selects the web file. The mobile `tsconfig` sets `customConditions: ["react-native"]`, so each app type-checks against its own file.
- **Rationale**: One import path, and the mapping is visible in one `package.json`. Vite, Metro and TypeScript all read it.
- **Alternatives considered**: Resolving `.web.tsx` and `.native.tsx` by extension needs extra configuration in Vite and TypeScript.

## R3. Web-only components on mobile

- **Decision**: A catch-all export maps `./*` to `./src/web/*.tsx` for `default`, and to `null` for `react-native`.
- **Rationale**: Importing a web-only component in the mobile app fails at type check and at bundling, not as a blank screen. The import path stays the same when a component is ported later.

## R4. React version

- **Decision**: Pin `react` and `react-dom` to 19.3.0 through root `overrides`.
- **Rationale**: Expo SDK 58's `bundledNativeModules.json` pins React 19.3.0 and React Native 0.88.1. The website currently resolves 19.3.1. This patch downgrade is checked by the full web test suite.

## R5. Native styling

- **Decision**: [Uniwind](https://docs.uniwind.dev/) (1.13.2, MIT, Tailwind 4).
- **Alternatives considered**: NativeWind's stable 4.2.7 is not on Tailwind 4, and version 5 is at 5.0.0-rc.1.

## R6. Native Button

- **Decision**: Adapt the [React Native Reusables Uniwind Button](https://github.com/mrzachnugent/react-native-reusables) into `button.native.tsx` by hand, using our variant and size names. String children are wrapped in a styled `Text`, so usage matches the web.
- **Rationale**: One file with no new primitives package. The website's Button has more sizes than the registry version, and the shared types require all of them.
- **Alternatives considered**: The Reusables CLI assumes a single-app layout and adds a Text component and context we do not need yet.

## R7. Tokens

- **Decision**: `tokens.json` is the source. A small Node script writes `generated/principal.css` in the website's existing format, and `generated/uniwind.css` in [Uniwind's theme format](https://docs.uniwind.dev/theming/custom-themes). Generated files are committed, and a test fails if they are out of date.
- **Rationale**: No build step on install. Website CSS variables stay byte-compatible, and the existing theme test keeps checking the same values.
- **Alternatives considered**: Style Dictionary is a new dependency for two small outputs.

## R8. Tailwind scanning

- **Decision**: The website's `styles.css` adds `@source` for `packages/ui/src` and excludes `*.native.tsx`. The mobile `global.css` adds `@source` for the Button folder and app `src`.
- **Rationale**: Classes outside the app's folder are not scanned otherwise. Excluding native files keeps the website's CSS unchanged, which is checked against a baseline build.

## R9. Testing

- **Decision**: Existing tests move with their code. A new test checks package boundaries, and a `jest-expo` smoke test renders the native Button and starter screen.
- **Rationale**: These tests run without a simulator (constitution IV). Starting on a real simulator is a manual step in [quickstart.md](quickstart.md).

## R10. Out of scope for now

`App.tsx` hooks, storage interfaces and other native components wait until the native chat feature needs them (constitution V).
