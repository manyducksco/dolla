# Components

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Views

A View returns markup. It receives `(props, context)` and returns a `Renderable` (typically JSX). The `this` inside a View is the same as the `context` argument.

```jsx
function ExampleView(props) {
  return (
    <section>
      <header>
        <h2>{props.title}</h2>
      </header>
      <article>{props.children}</article>
    </section>
  );
}
```

Mount a View onto a DOM node:

```jsx
await createRoot("#app").mount(ExampleView);
```

Use the context argument for hooks and context data:

```jsx
function ExampleView(props, context) {
  onMount(context, () => {
    // ...
  });

  return <p>{props.title}</p>;
}
```

`this` also works, but the explicit argument is easier to follow and works with arrow functions.

### Props and children

Props are passed in the component tag and are available on the `props` argument:

```jsx
function Greeting(props) {
  return <p>Hello, {props.name}!</p>;
}

function App() {
  const [getUserName] = createAtom("Alice");
  return <Greeting name={getUserName} />;
}
```

Pass a getter (`name={getUserName}`) to keep the prop reactive. Pass a plain value (`name="Alice"`) when it never changes. A child does not re-render when its parent's state changes; see [Props and the run-once model](./templates.md#props-and-the-run-once-model) for the full explanation and patterns.

Children are passed between the component tags and are available as `props.children`:

```jsx
function Card(props) {
  return <section class="card">{props.children}</section>;
}

<Card>
  <p>Hello</p>
</Card>;
```

## Stores

A Store returns shared state and logic. Parent creates it with `addStore`, children retrieve it with `getStore`.

```jsx
function ExampleStore(props) {
  const [getCount, setCount] = createAtom(props.initialCount ?? 0);
  const increment = (amount = 1) => setCount((count) => count + amount);
  const decrement = (amount = 1) => setCount((count) => count - amount);
  const reset = () => setCount(0);
  return { getCount, increment, decrement, reset };
}

function App(props, context) {
  addStore(context, ExampleStore, { initialCount: 12 });

  return (
    <main>
      <Counter />
      <Counter />
    </main>
  );
}

function Counter(props, context) {
  const store = getStore(context, ExampleStore);

  return (
    <>
      <p>Count: {store.getCount}</p>
      <button onClick={store.increment}>+</button>
      <button onClick={store.decrement}>-</button>
    </>
  );
}
```

A store instance is available to all components in its subtree. Check existence with `hasStore(context, store)` or `hasOwnStore(context, store)`. See [Stores vs Views](./concepts.md#stores-vs-views) for the conceptual difference.

## Type helpers

`createView` and `createStore` are identity functions used for type inference. They return the function you pass in unchanged.

```tsx
const Greeting = createView(function (props: { name: string }) {
  return <p>{props.name}</p>;
});

const CounterStore = createStore(function (props: { initial: number }) {
  const [getCount, setCount] = createAtom(props.initial);
  return { getCount, increment: () => setCount((count) => count + 1) };
});
```

They infer `this` and `context` as `Context` and type the props argument. They do not change runtime behavior. For props that may be getters, type them as `T | Getter<T>` or use `MaybeGetter<T>`. See [Advanced internals](./advanced.md#core-types).

## Lifecycle

Components hook into their lifecycle with `onMount`, `onCleanup`, and `onEffect`. The first argument is the context:

```jsx
function Example(props, context) {
  onMount(context, () => {
    // The component is on the page.
  });

  onCleanup(context, () => {
    // The component is leaving the page.
  });

  onEffect(context, () => {
    // Auto-tracking effect, cleaned up on unmount.
  });

  return <p>Hello</p>;
}
```

See [Hooks](./hooks.md) for the full lifecycle and visibility hook reference.

## Control flow helpers

### `showIf` / `hideIf`

Conditionally render content:

```jsx
{showIf(getIsLoggedIn, <p>Welcome!</p>)}
{showIf(getIsLoading, <p>Loading...</p>)}
{hideIf(getIsLoading, <p>Content</p>, <p>Loading...</p>)}
```

Conditions can be getters (reactive) or plain values (evaluated once).

By default, hidden content is unmounted. Wrap a branch side in `keepAlive` to hide it without unmounting:

```jsx
import { keepAlive, showIf } from "@manyducks.co/dolla";

{showIf(getActiveTab, keepAlive(<Editor />))}
```

A hidden side keeps its signals, stores, DOM, refs, listeners, and effects alive; only its DOM is detached. This is useful for tabs, panels, and forms where losing state would be disruptive.

Things to know:

- `keepAlive` must wrap the **entire branch side**, not a nested child.
- Effects, timers, and fetches keep running while hidden. Use `onHide` / `onShow` (see [Hooks](./hooks.md)) to pause work explicitly.
- `onCleanup` does **not** run when content is hidden; it runs when the owner unmounts.
- Hidden content is absent from the document, so `querySelector` won't find it and it is hidden from assistive technology.
- Focus and text selection are lost. Media and iframe state may reset on show.
- Memory is retained until the conditional owner unmounts. There is one retained instance per branch side.
- `keepAlive` is only meaningful inside a helper that supports it, such as `showIf` / `hideIf`.

See [Keep-alive caveats](./advanced.md#keep-alive-caveats) for the edge cases.

### `branch`

Renders one of several cases based on a reactive value, like a `switch` statement:

```jsx
{branch(
  getStatus,
  {
    loading: <p>Loading...</p>,
    ready: <Profile />,
    error: <p>Something went wrong.</p>,
  },
  <p>Unknown status</p>,
)}
```

Pass cases as an object keyed by the match values, or as an array of `[value, content]` tuples when the match values are not strings or symbols:

```jsx
const tabs = [
  [tabA, <TabA />],
  [tabB, <TabB />],
];

{branch(getActiveTab, tabs, <EmptyTab />)}
```

- Values can be getters (reactive) or plain values (evaluated once).
- Cases match with strict equality (`===`), like `switch`. Tuple keys can be objects, numbers, `null`, or any other value and are matched by identity.
- Object keys follow normal object property rules, so numeric and boolean values match their string keys.
- There is no fallthrough; only the first matching case is rendered.
- Pass the fallback as the third argument. Without one, an unmatched value renders nothing.
- Cases and the fallback support `keepAlive`, so hidden branch content can retain its state.

### `showUnless` / `hideUnless`

`showUnless` and `hideUnless` are aliases of `hideIf` and `showIf`. Prefer `showIf` / `hideIf` in new code; the aliases exist for readability in some templates.

### `forEach`

Render a dynamic, keyed list:

```jsx
<ul>
  {forEach(
    getItems,
    (item) => item.id,
    (getItem, getIndex) => (
      <li>
        {getIndex}: {() => getItem().name}
      </li>
    ),
  )}
</ul>
```

`forEach` takes a list or a getter for a list:

- The key function receives plain `(item, index)` values.
- The render function receives `item` and `index` as **getters**.
- Read those getters inside another getter or `compose` to stay reactive. Writing `{getItem().name}` evaluates once.
- Items with the same key reuse their existing DOM node when the list changes.
- For a static array that never changes, a plain `.map()` is fine. Use `forEach` when the list is reactive.

### `createPortal`

Render content into a different DOM element:

```jsx
import { createPortal } from "@manyducks.co/dolla";

function Modal() {
  return createPortal(
    document.getElementById("modal-root"),
    <div class="modal">...</div>,
  );
}
```

Portal content is physically outside the logical parent. Make sure the target exists, and manage focus and ARIA relationships manually when moving dialogs or menus outside the tree. Portals participate in `keepAlive` visibility: their content is retained and removed from the target while the branch is hidden.

## Context

The context object carries lifecycle state, stores, debug loggers, and arbitrary data down the component tree via prototypal inheritance.

```jsx
function Parent(props, context) {
  const [getUser] = createAtom({ name: "Alice" });
  context.user = getUser;
  return <Child />;
}

function Child(props, context) {
  // context.user is inherited from the parent's context.
  return <p>{() => context.user().name}</p>;
}
```

See [Context as the wiring harness](./concepts.md#context-as-the-wiring-harness) for the bigger picture.
