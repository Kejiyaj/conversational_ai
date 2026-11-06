# Contract: Button API

Defined in `packages/ui/src/button/button.types.ts`. Both implementations must satisfy it.

| Option | Values | Default |
| --- | --- | --- |
| `variant` | `default`, `outline`, `secondary`, `ghost`, `destructive`, `link` | `default` |
| `size` | `default`, `xs`, `sm`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg` | `default` |
| `className` | string | none |
| `disabled` | boolean | `false` |
| `children` | Node | none |

Platform props are not shared:

| | Web | Mobile |
| --- | --- | --- |
| Press handler | `onClick` | `onPress` |
| Other props | `button` element props, `asChild` | `Pressable` props |

Plain text children work on both platforms. Mobile wraps them in a styled `Text`.

The web Button's classes and output do not change from the current implementation. Native variant and size tables are typed as `Record` over the shared unions, so adding a value without a native style fails the type check.
