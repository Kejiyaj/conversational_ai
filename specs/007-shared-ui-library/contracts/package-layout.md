# Contract: Package Layout

| Folder | Package | Holds | May import |
| --- | --- | --- | --- |
| `apps/web` | `@convai/web` | Website screens, browser services | All packages |
| `apps/mobile` | `@convai/mobile` | Mobile screens, device services | All packages, except web-only components |
| `packages/ui` | `@convai/ui` | Shared components | `@convai/core`, `@convai/tokens` |
| `packages/core` | `@convai/core` | API client, types, pure logic | No UI or platform code |
| `packages/tokens` | `@convai/tokens` | Brand values | Nothing |

Rules:

- Packages never import from `apps/`. A test enforces this.
- Brand values appear only in `packages/tokens`. A test enforces this.
- A component ported to native moves from `packages/ui/src/web/<name>.tsx` to `packages/ui/src/<name>/`, and gets its own entry in `exports`. Its import path does not change.

## Import paths

| Import | Web gets | Mobile gets |
| --- | --- | --- |
| `@convai/ui/button` | `src/button/button.web.tsx` | `src/button/button.native.tsx` |
| `@convai/ui/<name>` | `src/web/<name>.tsx` | Error at type check and bundling |
| `@convai/core` | `src/index.ts` | `src/index.ts` |
| `@convai/tokens/principal.css` | Generated web theme | Not used |
| `@convai/tokens/uniwind.css` | Not used | Generated mobile theme |
