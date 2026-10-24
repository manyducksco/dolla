# FAQ

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

### Why isn't my value updating?

You probably called the getter:

```js
html`<p>${count()}</p>`; // evaluated once
html`<p>${count}</p>`;   // tracked and reactive
```

See [Templates](./templates.md#interpolation).

### Why don't my props update?

Views run once. A child captures its `props` when it mounts; a parent state change does not re-run the parent or the child. Pass a getter when the prop should change:

```js
function Child(props) {
  return html`<p>${() => props.name()}!</p>`;
}

html`<${Child} name=${name} />`;
```

If a prop must be replaced as a plain value, create a new child with `showIf` or a keyed `forEach`. See [Props and the run-once model](./templates.md#props-and-the-run-once-model).

### How do I update a list?

Use `forEach` for reactive lists. The render callback receives getters:

```js
html`<ul>${forEach(items, (item) => item.id, (item) => html`
  <li>${() => item().name}</li>
`)}</ul>`;
```

Use a plain `.map()` only for an array that never changes. See [forEach](./components.md#foreach).

### How do I do async data? Is there React-style Suspense?

There is no React-style Suspense or thrown-promise boundary. Model async work as state and branch on it:

```js
const [user, setUser] = createAtom(null);
const [loading, setLoading] = createAtom(true);

html`<div>${showIf(
  loading,
  html`<p>Loading...</p>`,
  keepAlive(html`<${UserView} />`), // optional: preserve the loaded view
)}</div>`;
```

The router has `preload`, `progress`, lazy routes, and `errorView` for route-level async. See [Router](../src/router/README.md).

### Why did my effect run before the DOM was ready?

`createEffect` runs immediately when it is created. Inside a view, use `onEffect` or `onMount`; both run after the view's DOM is mounted.

See [When updates run](./concepts.md#when-updates-run) and [Effects](./effects.md).

### Why doesn't `onCleanup` run when content is hidden?

If the content is a `keepAlive` branch side, hiding it keeps it alive instead of unmounting it. `onCleanup` runs only when the owner is disposed. Use `onHide` / `onShow` to pause work while hidden.

See [Visibility hooks](./hooks.md#visibility-hooks).

### How do I access a DOM node?

Use `createRef` or a callback ref:

```js
const inputRef = createRef();
html`<input ref=${inputRef} />`;
// later: inputRef()?.focus()
```

See [Refs](./refs.md).

### How do I share state between components?

Use a Store, which is scoped to a subtree through the context chain:

```js
function App() {
  addStore(this, CounterStore);
  return html`<${Counter} />`;
}

function Counter() {
  const store = getStore(this, CounterStore);
  return html`<p>${store.count}</p>`;
}
```

See [Stores](./components.md#stores).

### How do I show a loading or error state for a route?

The router exposes `progress` and `errorView`, and supports lazy route views:

```js
html`${showIf(() => router.progress() > 0, html`<p>Loading...</p>`)}`;
```

See [Router](../src/router/README.md) and [Translate](../src/translate/README.md) for locale-loading behavior.

### How do I style a component?

Use the `css` helper with `class`, or create a styled view with `styled.*`:

```js
const card = css`padding: 16px;`;
html`<div class=${card}>...</div>`;
```

See [CSS](./css.md).

### Is there a virtual DOM?

No. Updates target the exact DOM node that depends on the changed signal. Keyed lists reuse nodes and `keepAlive` can hide a branch, but there is no general diff or re-render cycle.

### Can a view return multiple root nodes?

Yes. Return an array, or use an `html` template with multiple top-level elements:

```js
function Layout() {
  return [html`<header>Header</header>`, html`<main>Main</main>`];
}
```

See [Templates](./templates.md#multiple-roots).

### Why is `this` undefined in my view?

Use a function declaration or function expression, not an arrow function. Views receive the context as `this`:

```js
function View() {
  onMount(this, () => {});
  return html`<p>Hello</p>`;
}
```

### How do I pass children to a component?

Put them between the tags and close with `<//>`:

```js
html`<${Card}><p>Hello</p><//>`;
```

Inside the component, render `props.children`. See [Components](./components.md#props-and-children).
