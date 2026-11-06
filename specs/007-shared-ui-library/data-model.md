# Data Model: Shared UI Library for Web and Mobile

This feature stores no runtime data. The one structured file is the token source.

## `packages/tokens/tokens.json`

| Field | Type | Rule |
| --- | --- | --- |
| `light` | Object of token name to CSS value | Holds every colour token, plus `radius` |
| `dark` | Object of token name to CSS value | Must define every colour token in `light` |

Generated outputs:

- `generated/principal.css`: `:root` and `.dark` blocks with `--<name>` variables, for the website.
- `generated/uniwind.css`: `@variant light` and `@variant dark` blocks with `--color-<name>` variables, for the mobile app.
