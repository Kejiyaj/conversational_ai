# Contract: Principal theme → shadcn variables

The single source of the theme is `frontend/src/theme/principal.css`. Components MUST read these
variables (through Tailwind classes such as `bg-primary`) and MUST NOT hard-code brand colors.

Values come from the Principal Design System (PDS) tokens on principal.com, recorded in the local,
uncommitted reference `../principal-theme/principal-tokens.css`.

| shadcn variable | Value | PDS source token |
|---|---|---|
| `--background` | `#ffffff` | `semantic-background-default` |
| `--foreground` | `#2f2f2f` | `semantic-text-default` |
| `--card` / `--popover` | `#ffffff` | `semantic-background-default` |
| `--card-foreground` / `--popover-foreground` | `#2f2f2f` | `semantic-text-default` |
| `--primary` | `#005fb8` | `component-button-primary-background` |
| `--primary-foreground` | `#ffffff` | `component-button-primary-text` |
| `--secondary` | `#e3f5fd` | `semantic-background-brand-default` |
| `--secondary-foreground` | `#002855` | `semantic-text-strong` |
| `--muted` | `#f7f7f7` | `semantic-background-subtle` |
| `--muted-foreground` | `#5e5e5e` | `semantic-text-subtle` |
| `--accent` | `#f2f9fd` | `semantic-background-info-subtle` |
| `--accent-foreground` | `#005fb8` | `semantic-text-interactive-default` |
| `--destructive` | `#c00000` | `semantic-text-error` |
| `--border` | `#dedede` | `semantic-border-subtle` |
| `--input` | `#8b8b8b` | `semantic-border-default` |
| `--ring` | `#3871ff` | header focus indicator |
| `--radius` | `1.5rem` (24px) | `pds-card` radius |
| `--sidebar` | `#f7f7f7` | `semantic-background-subtle` |
| `--sidebar-foreground` | `#2f2f2f` | `semantic-text-default` |
| `--sidebar-primary` | `#005fb8` | interactive default |
| `--sidebar-primary-foreground` | `#ffffff` | |
| `--sidebar-accent` | `#e3f5fd` | `semantic-background-brand-default` |
| `--sidebar-accent-foreground` | `#002855` | `semantic-text-strong` |
| `--sidebar-border` | `#dedede` | `semantic-border-subtle` |
| `--sidebar-ring` | `#3871ff` | focus indicator |
| `--font-sans` | `'FS Elliot Web Regular', Arial, sans-serif` | `base-type-font-family-100` |

**Hover:** primary buttons darken to `#004c97` (`component-button-primary-hover-background`). This is an
extra variable, `--primary-hover`, defined in `principal.css` and used by `button.tsx` in place of
shadcn's default `bg-primary/80`.

**Shape:** buttons are pills (`rounded-full`); the message box and bubbles use the 24px radius scale.

**Message bubbles:** user turns use `Bubble variant="default"` (Principal blue, white text); assistant
turns use `variant="secondary"` (light blue, navy text); the error reply uses `variant="destructive"`.

## Frontend ↔ backend contract

Unchanged. See `README.md` and `specs/001-chat-session-sidebar/contracts/sessions-api.md`.
