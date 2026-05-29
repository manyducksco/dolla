# Mental model

Dolla apps are built from three ideas: **signals**, **run-once views**, and **context inheritance**.

## Signals are the only dynamic thing

The component function runs exactly once. It returns a static tree of markup. Nothing ever re-runs that function. Instead, you place **getters** (the read-half of a signal) into the template where dynamic values are needed. The framework tracks which getters are used in which parts of the DOM and updates only those nodes when a signal changes.

```js
function Counter() {
  const [count, setCount] = createAtom(0);

  // This runs once. But the DOM updates when count changes,
  // because count (a getter) is interpolated in the template.
  return html`<p>${count}</p>`;
}
```

There is no virtual DOM, no diffing, no re-rendering. Every update is a pinpoint operation on the exact DOM node that depends on the changed signal.

## Values flow through getters

A signal produces a getter — a function that returns the current value and registers itself as a dependency of whatever tracking context it's called in.

```js
// Passing a getter keeps things reactive:
return html`<p>${count}</p>`;

// Calling the getter produces a static value — reactivity is lost:
return html`<p>${count()}</p>`;

// Wrap in a function to re-introduce reactivity:
return html`<p>${() => count()}</p>`;
```

The same rule applies everywhere — `compose`, `createEffect`, `onEffect`, `showIf`, CSS template functions, and any markup interpolation. If you pass a getter, the framework tracks it. If you pass a plain value, it's used once.

```js
compose(() => count() * 2);  // tracks count — reactive
compose(count() * 2);        // plain number — static

showIf(() => user().isLoggedIn, ...); // reactive
showIf(user().isLoggedIn, ...);       // static
```

### Kinds of signals

| Primitive | Purpose |
|---|---|
| `createAtom(value)` | Mutable state — returns `[getter, setter]` |
| `compose(fn)` | Derived state — returns a getter that recomputes when dependencies change |
| `createEffect(fn)` | Side-effect — runs `fn` immediately, re-runs when tracked getters change |

### Tracking contexts

Getters are only tracked when called inside a **tracking context**:

- The function passed to `compose`
- The function passed to `createEffect` / `onEffect`
- A getter interpolated in an `html` template (`${someGetter}`)
- The condition function of `showIf` / `hideIf`
- A function value in a `css` template
- Reactive attributes and props (`value=${getter}`)

Outside these, calling a getter returns the current value without registering a dependency. Use `peek(getter)` to explicitly read without tracking even inside a tracking context.

## The component runs once

This is the single most important thing to internalize. A view function is called once when the component is created. It sets up signals, wires up effects, and returns a static markup description. There are no re-renders, no reconciliation, no lifecycle methods that re-execute the function.

```js
function Welcome({ name }) {
  // This runs once.
  const greeting = compose(() => `Hello, ${name()}!`);

  return html`<p>${greeting}</p>`;
}
```

If `name` changes, only the text node inside `<p>` updates — `Welcome` does not re-run, `compose` does not re-run (until it's read), and no diffing occurs.

This means:
- Event handlers, timers, and subscriptions set up in the component persist for its entire lifetime. No need to re-attach them.
- State is initialized once. No effect cleanup and re-setup on every "render."
- The mental model is closer to "build a circuit" than "re-render a function."

## Context as the wiring harness

Every component receives a context object (`this` inside a view). Contexts form a chain via prototypal inheritance — when you read `this.something`, it walks up the chain until it finds a value.

```js
function Parent() {
  // Attach signals directly to the context
  const [user] = createAtom({ name: "Alice" });
  this.user = user;
  return html`<${Child} />`;
}

function Child() {
  // Inherited from parent's context
  return html`<p>${() => this.user().name}</p>`;
}
```

The context chain serves as the dependency injection system for:

- **Stores** — `addStore` attaches a store instance to the current context; `getStore` walks up the chain to find it
- **Router state** — accessed via `getRouter(context)`
- **Translate state** — accessed via `getTranslate(context)`
- **Arbitrary data** — any property you set on `this` becomes available to descendants

## Plugins extend the context

A plugin is a function that receives the root context and can attach anything to it. The router and translate systems are plugins:

```js
createRoot("#app")
  .plugin(createRouter({ routes: [...] }))
  .mount(App);
```

The plugin runs once during setup, attaches its stores and API to the context, and those become available to every component in the tree via `getRouter(context)` / `getTranslate(context)`.

## DOM updates are async (microtask)

When a signal changes, DOM updates are not applied immediately. Instead, they're collected and flushed as a **microtask** via `queueMicrotask`. This means multiple signal changes coalesce into a single DOM update:

```js
setCount(1);
setName("Alice");
setAge(30);
// DOM updates once after this synchronous block
```

Use `batch(fn)` to guarantee a single update even if signal changes happen across multiple turns of synchronous code:

```js
batch(() => {
  setCount(1);
  setName("Alice");
});
```

## Stores vs Views

A View returns markup. A Store returns state and logic. They share the same function shape and both have access to the context (`this`), but they serve different purposes.

```js
// Store — state and logic, no markup
function CounterStore() {
  const [count, setCount] = createAtom(0);
  return { count, increment: () => setCount(c => c + 1) };
}

// View — markup, uses the store
function Counter() {
  const store = getStore(this, CounterStore);
  return html`<p>${store.count}</p>`;
}
```

Stores are created once per subtree (via `addStore`) and shared by all child views (via `getStore`). They follow the same run-once model — the store function body runs exactly once, and its state persists for the lifetime of the subtree.

## What signals replace

If you're coming from another framework, here's how the pieces map:

| Concept | In Dolla |
|---|---|
| Component re-render | Getters in the template — pinpoint DOM updates |
| `useState` / `setState` | `createAtom` |
| `useMemo` | `compose` |
| `useEffect` | `createEffect` (standalone) or `onEffect` (component-scoped) |
| `useCallback` | A plain function — no re-renders means no need for referential stability |
| `useContext` | `this.property` or `getStore(this, Store)` |
| `useRef` | `createRef` |
| Virtual DOM / diffing | None — direct DOM updates via tracked dependencies |
| `useReducer` | A custom setter function wrapping `createAtom` |
| Suspense | Route `preload` / `errorView` — declarative async boundaries per route layer |
