# Components

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

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
await createRoot("#app").mount(ExampleView);
```

Use function declarations (or function expressions), not arrow functions, when the view reads `this` for context or hooks.

### Props and children

Props are passed in the component tag and are available on the `props` argument:

```js
function Greeting(props) {
  return html`<p>Hello, ${props.name}!</p>`;
}

function App() {
  const [name] = createAtom("Alice");
  return html`<${Greeting} name=${name} />`;
}
```

Pass a getter (`name=${name}`) to keep the prop reactive. Pass a plain value (`name="Alice"`) when it never changes. A child does not re-render when its parent's state changes; see [Props and the run-once model](./templates.md#props-and-the-run-once-model) for the full explanation and patterns.

Children are passed between the component tags and are available as `props.children`:

```js
function Card(props) {
  return html`<section class="card">${props.children}</section>`;
}

html`<${Card}><p>Hello</p><//>`;
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

A store instance is available to all components in its subtree. Check existence with `hasStore(context, store)` or `hasOwnStore(context, store)`. See [Stores vs Views](./concepts.md#stores-vs-views) for the conceptual difference.

## Type helpers

`createView` and `createStore` are identity functions used for type inference. They return the function you pass in unchanged.

```ts
const Greeting = createView(function (props: { name: string }) {
  this.name = "Greeting";
  return html`<p>${props.name}</p>`;
});

const CounterStore = createStore(function (props: { initial: number }) {
  const [count, setCount] = createAtom(props.initial);
  return { count, increment: () => setCount((c) => c + 1) };
});
```

They infer `this` and `context` as `Context` and type the props argument. They do not change runtime behavior. See [Advanced internals](./advanced.md#core-types) for the underlying types.

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
html`<div>${showIf(isLoading, html`<p>Loading...</p>`)}</div>`;
html`<div>${hideIf(isLoading, html`<p>Content</p>`, html`<p>Loading...</p>`)}</div>`;
```

Conditions can be getters (reactive) or plain values (evaluated once).

By default, hidden content is unmounted. Wrap a branch side in `keepAlive` to hide it without unmounting:

```js
import { keepAlive, showIf } from "@manyducks.co/dolla";

html`<div>${showIf(activeTab, keepAlive(html`<${Editor} />`))}</div>`;
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

### `branch`

Renders one of several cases based on a reactive value, like a `switch` statement:

```js
html`${branch(status, {
  loading: html`<p>Loading...</p>`,
  ready: html`<${Profile} />`,
  error: html`<p>Something went wrong.</p>`,
}, html`<p>Unknown status</p>`)}`;
```

Pass cases as an object keyed by the match values, or as an array of `[value, content]` tuples when the match values are not strings or symbols:

```js
const tabs = [
  [tabA, html`<${TabA} />`],
  [tabB, html`<${TabB} />`],
];

html`${branch(activeTab, tabs, html`<${EmptyTab} />`)}`;
```

- Values can be getters (reactive) or plain values (evaluated once).
- Cases match with strict equality (`===`), like `switch`. Tuple keys can be objects, numbers, `null`, or any other value and are matched by identity.
- Object keys follow normal object property rules, so numeric and boolean values match their string keys.
- There is no fallthrough; only the first matching case is rendered.
- Pass the fallback as the third argument. Without one, an unmatched value renders nothing.
- Cases and the fallback support `keepAlive`, so hidden branch content can retain its state.

### `showUnless` / `hideUnless`

Inverse of the above:

```js
html`<div>${showUnless(isLoggedIn, html`<p>Please log in.</p>`)}</div>`;
```

| Helper        | Condition truthy | Condition falsy | Alias        |
| ------------- | ---------------- | --------------- | ------------ |
| `showIf`      | `content`        | `fallback`      | —            |
| `hideIf`      | `fallback`       | `content`       | —            |
| `showUnless`  | `fallback`       | `content`       | `hideIf`     |
| `hideUnless`  | `content`        | `fallback`      | `showIf`     |

`showUnless` / `hideUnless` are aliases; the table shows why they are easy to mix up.

### `forEach`

Render a dynamic, keyed list:

```js
html`<ul>${forEach(items, (item) => item.id, (item, index) => {
  return html`<li>${() => item().name}</li>`;
})}</ul>`;
```

`forEach` takes a list or a getter for a list:

- The key function receives plain `(item, index)` values.
- The render function receives `item` and `index` as **getters**.
- Read those getters inside another getter or `compose` to stay reactive. Writing `${item.name}` is wrong; writing `${item().name}` evaluates once.
- Items with the same key reuse their existing DOM node when the list changes.
- For a static array that never changes, a plain `.map()` is fine. Use `forEach` when the list is reactive.

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

Portal content is physically outside the logical parent. Make sure the target exists, and manage focus and ARIA relationships manually when moving dialogs or menus outside the tree. Portals participate in `keepAlive` visibility: their content is retained and removed from the target while the branch is hidden.

## Context

The context object carries lifecycle state, stores, debug loggers, and arbitrary data down the component tree via prototypal inheritance.

```js
function Parent() {
  const [user] = createAtom({ name: "Alice" });
  this.user = user;
  return html`<${Child} />`;
}

function Child() {
  // this.user is inherited from the parent's context
  return html`<p>${() => this.user().name}</p>`;
}
```
