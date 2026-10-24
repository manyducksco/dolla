# Advanced internals

This page covers public exports that are lower-level than the normal helpers. They are useful for integrations and custom nodes, but they are **advanced APIs** and may change more readily than `html`, `showIf`, `createAtom`, and the other user-facing helpers.

## Core types

| Type | Meaning |
| --- | --- |
| `Renderable` | Everything accepted as content: strings, numbers, DOM nodes, markup, getters, arrays, and `null`/`false`/`undefined`. |
| `MaybeGetter<T>` | `T` or `() => T`. |
| `Getter<T>` | A function returning the current value and registering a dependency when read in a tracking context. |
| `Setter<T>` | A function that writes a value or an updater function. |
| `View<Props>` | `(this: Context, props: Props, context: Context) => Renderable`. |
| `Store<Props, Value>` | A function returning shared state/logic, usually registered with `addStore`. |
| `Context` | The prototype-inherited object passed to views and stores. |
| `Markup` | A description of an element/component: `{ type, props }` with the internal `IS_MARKUP` marker. |
| `MarkupNode` | The runtime object that mounts, updates, moves, and unmounts markup. |

See [Templates](./templates.md#what-can-be-rendered) for the user-facing renderable rules.

## `createMarkup(type, props)`

Creates a `Markup` description without rendering it:

```js
import { createMarkup } from "@manyducks.co/dolla";

const heading = createMarkup("h1", { children: "Hello" });
const view = createMarkup(MyView, { name: "Alice" });
const custom = createMarkup(MyMarkupNode, { args: [someArgument] });
```

For intrinsic tags, `type` is the tag string and `props` are the element props. For a View, `type` is the view function and `props` is the props object. For a `MarkupNode` subclass, `type` is the class and `props.args` are the constructor arguments after the context.

## `render(content, context?)`

Converts a `Renderable` into a single `MarkupNode`:

```jsx
import { createContext, render } from "@manyducks.co/dolla";

const context = createContext(null);
const node = render(<p>Hello</p>, context);
node.mount(document.body);
```

`render` returns a single node; multiple roots are wrapped in a fragment. You normally use `createRoot` instead of calling `render` directly.

## Custom `MarkupNode`

A custom node extends `MarkupNode` and implements:

```ts
abstract class MarkupNode {
  abstract getRoot(): Node | undefined;
  abstract isMounted(): boolean;
  abstract mount(parent: MountTarget, after?: Node | null): void;
  abstract unmount(skipDOM?: boolean): void;
  abstract move(parent: MountTarget, after?: Node | null): void;
}
```

- `getRoot` returns the DOM node representing this node's position. It may be an anchor text node.
- `isMounted` should be true while the node is attached to a parent.
- `mount` inserts the node, usually after `after`.
- `unmount` removes DOM unless `skipDOM` is true, and releases subscriptions, refs, and contexts.
- `move` repositions the node without remounting when possible; use `moveBefore` when available to preserve DOM state.

`MountTarget` is the minimal interface the framework mounts into:

```ts
interface MountTarget {
  insertBefore(node: Node, child: Node | null): any;
  moveBefore?(node: Node, child: Node | null): any;
  appendChild(node: Node): any;
  firstChild: Node | null;
}
```

## Exported node classes

These are available for advanced integrations:

- `DOMNode` — wrapper for a plain DOM node.
- `ElementNode` — an HTML/SVG element.
- `ViewNode` — a mounted View.
- `RepeatNode` — keyed list rendering used by `repeat`.
- `DynamicNode` — renders any renderable and updates it when its getter changes.
- `PortalNode` — renders content into another DOM parent.

Prefer the helpers (JSX, `html`, `repeat`, `showIf`, `createPortal`) unless you are building a custom rendering primitive.

## Standalone effects

`createEffect` is the advanced counterpart to `onEffect`. Use it when you need an effect outside the normal context tree — a module-level integration, a test harness, or a plain signal setup with no view or store.

```js
import { createAtom, createEffect } from "@manyducks.co/dolla";

const [getCount, setCount] = createAtom(0);

const stop = createEffect(() => {
  console.log("Count is:", getCount());
});

setCount(1); // logs "Count is: 1"

stop();
```

`createEffect` runs the callback immediately, tracks the getters read inside it, and returns a stop function. It does not clean itself up automatically; call the stop function when you are done.

The callback may return a cleanup function, which runs before the next invocation and when the effect is stopped:

```js
const stop = createEffect(() => {
  const id = setInterval(() => {
    // ...
  }, 1000);

  return () => clearInterval(id);
});
```

A deps-array form is available for explicit control. The callback receives the unwrapped values:

```js
createEffect(
  (count, name) => {
    console.log(`${name}: ${count}`);
  },
  [getCount, getName],
);
```

Prefer [`onEffect(context, ...)`](./effects.md) inside views and stores. `createEffect` is the backup for code that has no context.

## Stability

The helpers documented in Getting Started, Templates, Reactivity, Components, CSS, Refs, and Hooks are the stable surface. The classes and functions on this page are exported for flexibility, but their contracts may change between minor versions as the rendering internals evolve.
