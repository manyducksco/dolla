# Transitions

`transition()` animates content in and out using the Web Animations API.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

```jsx
import { transition } from "@manyducks.co/dolla";

transition({
  when: getOpen,
  enter: [
    { opacity: 0, transform: "translateY(-4px)" },
    { opacity: 1, transform: "none" },
  ],
  exit: [{ opacity: 1 }, { opacity: 0 }],
  duration: 180,
  easing: "ease-out",
  children: <div class="modal">...</div>,
});
```

## Behavior

- `when` controls whether the content is mounted. Pass a getter (such as an atom) for reactive behavior.
- While mounted, the content is wrapped in a plain `<div>`. The wrapper is unstyled by default.
- When `when` becomes truthy, the content is mounted and the `enter` keyframes run (if provided).
- When `when` becomes falsy, the `exit` keyframes run (if provided), and the content is unmounted after the animation finishes.
- If `enter` is omitted, the content appears immediately. If `exit` is omitted, it is removed immediately.
- The exit unmounts the content, so local component state resets. Move state that should survive into a store or an atom outside the transition.

Animations use `fill: "forwards"`. On entering finish, the final styles are committed before the animation is cancelled, so the element does not jump back.

## Props

| Prop | Type | Description |
| --- | --- | --- |
| `when` | `Getter<boolean>` | Whether the content is mounted. |
| `children` | `Renderable` | Content to animate. |
| `enter` | `Keyframe[] \| PropertyIndexedKeyframes` | Enter keyframes. |
| `exit` | `Keyframe[] \| PropertyIndexedKeyframes` | Exit keyframes. |
| `duration` | `number` | Duration for both phases. |
| `easing` | `string \| [number, number, number, number]` | Easing for both phases. A tuple is converted to `cubic-bezier(...)`. |
| `enterDuration` | `number` | Overrides `duration` for the enter phase. |
| `enterEasing` | `string \| tuple` | Overrides `easing` for the enter phase. |
| `exitDuration` | `number` | Overrides `duration` for the exit phase. |
| `exitEasing` | `string \| tuple` | Overrides `easing` for the exit phase. |

If no duration is provided, the Web Animations default is used (usually `0`), so set an explicit `duration` for visible transitions.

## Example with separate phases

```jsx
const [getOpen, setOpen] = createAtom(false);

transition({
  when: getOpen,
  enter: [
    { transform: "scale(0.96)", opacity: 0 },
    { transform: "scale(1)", opacity: 1 },
  ],
  exit: [
    { transform: "scale(1)", opacity: 1 },
    { transform: "scale(0.96)", opacity: 0 },
  ],
  enterDuration: 160,
  exitDuration: 120,
  easing: "ease-out",
  children: <div class="dialog">...</div>,
});
```

## Requirements and notes

- Requires `Element.prototype.animate` (Web Animations API) in the browser.
- The wrapper `<div>` is an extra DOM element. Style the child directly or target the wrapper through its child.
- Consider respecting `prefers-reduced-motion` in your app and skipping keyframes when the user requests reduced motion.

## Next steps

- [Components](./components.md#control-flow-helpers) — `showIf`, `branch`, and friends
- [CSS](./css.md) — styling the content
- [Cheatsheet](./cheatsheet.md) — quick lookups
