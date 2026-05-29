# Components

## Views

A View returns markup. It receives `(props, context)` and returns a `Renderable` (typically `html\`...\`` or JSX). The `this` inside a View is the same as the `context` argument.

```js
function ExampleView(props) {
  return html`
    <section>
      <header><h2>${props.title}</h2></header>
      <article>${props.children}</article>
    </section>
  `;
}
```

Mount a View onto a DOM node:

```js
createRoot(document.body).mount(ExampleView);
```

## Stores

A Store returns shared state and logic. Parent creates it with `addStore`, children retrieve it with `getStore`.

```js
function ExampleStore(props) {
  const [count, setCount] = createAtom(props.initialCount ?? 0);
  const increment = (amount = 1) => setCount((c) => c + amount);
  const decrement = (amount = 1) => setCount((c) => c - amount);
  const reset = () => setCount(0);
  return { count, increment, decrement, reset };
}

function App() {
  addStore(this, ExampleStore, { initialCount: 12 });

  return html`
    <main>
      <${Counter} />
      <${Counter} />
    </main>
  `;
}

function Counter() {
  const store = getStore(this, ExampleStore);
  return html`
    <p>Count: ${store.count}</p>
    <button onclick=${store.increment}>+</button>
    <button onclick=${store.decrement}>-</button>
  `;
}
```

A store instance is available to all components in its subtree. Check existence with `hasStore(context, store)` or `hasOwnStore(context, store)`.

## Type helpers

`createView` and `createStore` are identity functions for type inference:

```ts
const MyView = createView((props: { name: string }) => {
  return html`<p>${props.name}</p>`;
});
```

## Lifecycle

Components hook into their lifecycle with `onMount`, `onCleanup`, and `onEffect`. The first argument is always the context (`this`):

```js
function Example() {
  onMount(this, () => { /* component is on the page */ });
  onCleanup(this, () => { /* component is leaving the page */ });
  onEffect(this, () => { /* auto-tracking effect, cleaned up on unmount */ });

  return html`<p>Hello</p>`;
}
```

## Control flow helpers

### `showIf` / `hideIf`

Conditionally render content:

```js
html`<div>${showIf(isLoggedIn, html`<p>Welcome!</p>`)}</div>`;
html`<div>${hideIf(isLoading, html`<p>Loading...</p>`)}</div>`;
```

### `showUnless` / `hideUnless`

Inverse of the above:

```js
html`<div>${showUnless(isLoggedIn, html`<p>Please log in.</p>`)}</div>`;
```

### `forEach`

Render a dynamic, keyed list:

```js
html`<ul>${forEach(items, (item) => item.id, (item, index) => {
  return html`<li>${item.name}</li>`;
})}</ul>`;
```

### `createPortal`

Render content into a different DOM element:

```js
import { createPortal } from "@manyducks.co/dolla";

function Modal() {
  return createPortal(document.getElementById("modal-root"),
    html`<div class="modal">...</div>`
  );
}
```

## Context

The context object carries lifecycle state, stores, debug loggers, and arbitrary data down the component tree via prototypal inheritance.

```js
function Parent() {
  this.user = createAtom({ name: "Alice" });
  return html`<${Child} />`;
}

function Child() {
  // this.user is inherited from the parent's context
  return html`<p>${this.user().name}</p>`;
}
```
