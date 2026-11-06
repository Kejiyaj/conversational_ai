# Contract: Button API

Defined in `packages/ui/src/button/button.types.ts`. Both implementations must satisfy it.
Variants and sizes follow the Figma "button" component (amended for the Alfred design, PR #4).

| Option | Values | Default |
| --- | --- | --- |
| `variant` | `primary`, `secondary`, `link`, `ai`, `ghost` | `secondary` |
| `size` | `sm`, `md`, `lg`, `icon` | `lg` |
| `className` | string | none |
| `disabled` | boolean | `false` |
| `children` | Node | none |

Platform props are not shared:

| | Web | Mobile |
| --- | --- | --- |
| Press handler | `onClick` | `onPress` |
| Other props | `button` element props | `Pressable` props |

Plain text children work on both platforms. Mobile wraps them in a styled `Text`.

On native, `ai` is a solid strong blue, because React Native has no CSS gradients. Native variant and size tables are typed as `Record` over the shared unions, so adding a value without a native style fails the type check.
