# Advanced internals

This page covers public exports that are lower-level than the normal helpers. They are useful for integrations and custom nodes, but they are **advanced APIs** and may change more readily than `html`, `showIf`, `createAtom`, and the other user-facing helpers.

## Core types

| Type | Meaning |
|---|---|
| `Renderable` | Everything accepted as content: strings, numbers, DOM nodes, markup, getters, arrays, `null`/`false`/`undefined`, and keep-alive markers. |
| `MaybeGetter<T>` | `T` or `() => T`. |
| `Getter<T>` | A function returning the current value and registering a dependency when read in a tracking context. |
| `Setter<T>` | A function that writes a value or an updater function. |
| `View<Props>` | `(this: Context, props: Props, context: Context) => Renderable`. |
| `Store<Props, Value>` | A function returning shared state/logic, usually registered with `addStore`. |
| `Context` | The prototype-inherited object passed to views and stores. |
| `Markup` | A description of an element/component: `{ type, props }` with the internal `IS_MARKUP` marker. |
| `MarkupNode` | The runtime object that mounts, updates, moves, and unmounts markup. |
| `KeepAlive` | The branded descriptor returned by `keepAlive()`; normally consumed by `showIf`, `hideIf`, or `branch`. |

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

```js
import { createContext } from "@manyducks.co/dolla";
import { render } from "@manyducks.co/dolla";

const context = createContext(null);
const node = render(html`<p>Hello</p>`, context);
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
- `isMounted` should be true while the node is attached to a parent (including a detached fragment used by keep-alive).
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

`Element` and `DocumentFragment` both satisfy it. This is why hidden content can still update while detached.

## Exported node classes

These are available for advanced integrations:

- `DOMNode` — wrapper for a plain DOM node.
- `ElementNode` — an HTML/SVG element.
- `ViewNode` — a mounted View.
- `RepeatNode` — keyed list rendering used by `forEach`.
- `DynamicNode` — renders any renderable and updates it when its getter changes.
- `PortalNode` — renders content into another DOM parent.

Prefer the helpers (`html`, `forEach`, `showIf`, `createPortal`) unless you are building a custom rendering primitive.

## Visibility internals

`keepAlive(content)` returns a `KeepAlive` marker. The conditional owner (`showIf`, `hideIf`, or `branch`) detects the marker and hides the DOM by moving it into a detached `DocumentFragment`.

Use the public hooks rather than reaching into the scope directly:

- `onHide(context, fn)`
- `onShow(context, fn)`
- `isMounted(context)`
- `isVisible(context)`

`isMounted(context)` is the lifecycle check that replaced the old context field. `isVisible(context)` adds keep-alive visibility to it. The `MarkupNode.isMounted()` method above is a different concept: it describes whether the render node is attached to a parent, not whether the context is visible.

See [Visibility hooks](./hooks.md#visibility-hooks) and [Keep-alive](./components.md#control-flow-helpers).

## Stability

The helpers documented in Getting Started, Templates, Reactivity, Components, CSS, Refs, and Hooks are the stable surface. The classes and functions on this page are exported for flexibility, but their contracts may change between minor versions as the rendering internals evolve.
