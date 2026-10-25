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

A store instance is available to all components in its subtree. See [Stores vs Views](./concepts.md#stores-vs-views) for the conceptual difference.

## TypeScript

Type view and store functions directly. Type reactive props as `Getter<T>`; use `MaybeGetter<T>` when a prop accepts either a plain value or a getter. See [TypeScript props](./templates.md#typescript-props) for examples.

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

See [Hooks](./hooks.md) for the full lifecycle hook reference.

## Control flow helpers

### `showIf` / `hideIf`

Conditionally render content:

```jsx
{showIf(getIsLoggedIn, <p>Welcome!</p>)}
{showIf(getIsLoading, <p>Loading...</p>)}
{hideIf(getIsLoading, <p>Content</p>, <p>Loading...</p>)}
```

Conditions can be getters (reactive) or plain values (evaluated once).

Hidden content is unmounted. Use a store to keep state alive across mounts (recommended), or keep the atom outside the conditional content.

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

### `repeat`

Render a dynamic, keyed list:

```jsx
<ul>
  {repeat(
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

`repeat` takes a list or a getter for a list:

- The key function receives plain `(item, index)` values.
- The render function receives `item` and `index` as **getters**.
- Read those getters inside another getter or `compose` to stay reactive. Writing `{getItem().name}` evaluates once.
- Items with the same key reuse their existing DOM node when the list changes.
- For a static array that never changes, a plain `.map()` is fine. Use `repeat` when the list is reactive.

`forEach` is a deprecated alias of `repeat`. Use `repeat` in new code.

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

Portal content is physically outside the logical parent. Make sure the target exists, and manage focus and ARIA relationships manually when moving dialogs or menus outside the tree.

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
