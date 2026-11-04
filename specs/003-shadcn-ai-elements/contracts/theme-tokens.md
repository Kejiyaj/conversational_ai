# Contract: Principal theme → shadcn variables

The single source of the theme is `frontend/src/theme/principal.css`. Components MUST read these
variables (through Tailwind classes such as `bg-primary`) and MUST NOT hard-code brand colors.

Spec 003 took its values from the Principal Design System (PDS) tokens on principal.com. Spec 005
(2026-11-04, product owner decision) moved the brand family to navy and added a dark palette. The
light values below are the current ones; the dark palette is the `.dark` block in `principal.css`,
applied by `frontend/src/colorScheme.ts` when the system prefers dark. A test requires every light
color variable to have a dark value.

| shadcn variable | Light | Dark |
|---|---|---|
| `--background` | `#ffffff` | `#0f141b` |
| `--foreground` | `#16202c` | `#e6ebf1` |
| `--card` / `--popover` | `#ffffff` | `#151c25` |
| `--card-foreground` / `--popover-foreground` | `#16202c` | `#e6ebf1` |
| `--primary` | `#0b3a6e` | `#2f6fb6` |
| `--primary-hover` | `#0e4a8c` | `#3b7fca` |
| `--primary-foreground` | `#ffffff` | `#ffffff` |
| `--secondary` (assistant bubble) | `#e8f0fa` | `#1c2a3b` |
| `--secondary-foreground` | `#0b2545` | `#e6ebf1` |
| `--muted` | `#f5f7fa` | `#151c25` |
| `--muted-foreground` | `#5b6573` | `#9aa5b4` |
| `--accent` | `#eef3fa` | `#16263a` |
| `--accent-foreground` | `#0b3a6e` | `#9cc8ff` |
| `--destructive` | `#c00000` | `#ff6b6b` |
| `--border` | `#dde2e9` | `#2a3441` |
| `--input` | `#8a94a3` | `#4a5566` |
| `--ring` | `#3871ff` | `#6aa8ff` |
| `--brand-accent` (logo underline, avatar icon) | `#4cc3e8` | `#4cc3e8` |
| `--sidebar` | `#f5f7fa` | `#151c25` |
| `--sidebar-foreground` | `#16202c` | `#e6ebf1` |
| `--sidebar-primary` | `#0b3a6e` | `#2f6fb6` |
| `--sidebar-primary-foreground` | `#ffffff` | `#ffffff` |
| `--sidebar-accent` | `#e8f0fa` | `#1c2a3b` |
| `--sidebar-accent-foreground` | `#0b2545` | `#e6ebf1` |
| `--sidebar-border` | `#dde2e9` | `#2a3441` |
| `--sidebar-ring` | `#3871ff` | `#6aa8ff` |
| `--radius` | `1.5rem` (24px) | same |
| `--font-sans` | `'FS Elliot Web Regular', Arial, sans-serif` | same |

**Hover:** primary buttons use `--primary-hover` (used by `button.tsx` in place of shadcn's default
`bg-primary/80`).

**Shape:** buttons are pills (`rounded-full`); the message box and bubbles use the 24px radius scale.

**Message bubbles:** user turns use `Bubble variant="default"` (navy, white text); assistant
turns use `variant="secondary"` (light blue-grey, navy text); the error reply uses `variant="destructive"`.

## Frontend ↔ backend contract

Unchanged. See `README.md` and `specs/001-chat-session-sidebar/contracts/sessions-api.md`.
