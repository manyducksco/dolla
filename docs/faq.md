# FAQ

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown. For task-oriented snippets, see the [Cheatsheet](./cheatsheet.md).

### Why isn't my value updating?

You probably called the getter:

```jsx
<p>{getCount()}</p>; // evaluated once
<p>{getCount}</p>;   // tracked and reactive
```

See [Values flow through getters](./concepts.md#values-flow-through-getters).

### Why is my value static?

Same cause: a getter was called in the template or in an attribute. Pass the getter itself, or wrap the work in another getter:

```jsx
<p>{() => getCount() * 2}</p>;
<p>{compose(() => getCount() * 2)}</p>;
```

See [Values flow through getters](./concepts.md#values-flow-through-getters).

### Why don't my props update?

Views run once. A child captures its `props` when it mounts; a parent state change does not re-run the parent or the child. Pass a getter when the prop should change:

```jsx
function Child(props) {
  return <p>{props.name}!</p>;
}

<Child name={getUserName} />;
```

See [Props and the run-once model](./templates.md#props-and-the-run-once-model) for how run-once views receive props.

### How do I update a list?

Use `repeat` for reactive lists. The render callback receives getters:

```jsx
<ul>
  {repeat(
    getItems,
    (item) => item.id,
    (getItem) => <li>{() => getItem().name}</li>,
  )}
</ul>
```

Use a plain `.map()` only for an array that never changes. See [`repeat`](./components.md#repeat).

### How do I do async data? Is there React-style Suspense?

There is no React-style Suspense or thrown-promise boundary. Model async work as state and branch on it:

```jsx
const [getUser, setUser] = createAtom(null);
const [getLoading, setLoading] = createAtom(true);

<div>
  {showIf(getLoading, <p>Loading...</p>, <UserView user={getUser} />)}
</div>;
```

The router has `preload`, `progress`, lazy routes, and `errorView` for route-level async. See [Router](./../src/router/README.md).

### Why did my effect run before the DOM was ready?

Inside a view or store, use `onEffect`; it runs after the view's DOM is mounted. `onMount` also runs after mount, but it does not re-run when state changes.

See [When updates run](./concepts.md#when-updates-run) and [Effects](./effects.md).

### How do I access a DOM node?

Use `createRef` or a callback ref:

```jsx
const inputRef = createRef();

<input ref={inputRef} />;

onMount(context, () => inputRef().focus());
```

See [Refs](./refs.md).

### How do I share state between components?

Use a Store, which is scoped to a subtree through the context chain:

```jsx
function App(props, context) {
  addStore(context, CounterStore);
  return <Counter />;
}

function Counter(props, context) {
  const store = getStore(context, CounterStore);
  return <p>{store.getCount}</p>;
}
```

See [Stores](./components.md#stores).

### How do I show a loading or error state for a route?

The router exposes `progress` and `errorView`, and supports lazy route views:

```jsx
{showIf(() => router.progress() > 0, <p>Loading...</p>)}
```

See [Router](./../src/router/README.md) and [Translate](./../src/translate/README.md) for locale-loading behavior.

### How do I style a component?

Use a plain class string, a CSS module class name, or the optional `css` helper:

```jsx
const card = css`
  padding: 16px;
`;

<div class={card}>...</div>;
```

To style a component, attach the class inside its view. See [CSS](./css.md).

### Is there a virtual DOM?

No. Updates target the exact DOM node that depends on the changed signal. Keyed lists reuse nodes, but there is no general diff or re-render cycle.

### Can a view return multiple root nodes?

Yes. Return an array, or use a fragment:

```jsx
function Layout() {
  return (
    <>
      <header>Header</header>
      <main>Main</main>
    </>
  );
}
```

See [Templates](./templates.md#what-can-be-rendered).

### Why is `this` undefined in my view?

You used an arrow function. Use the context argument instead:

```jsx
function View(props, context) {
  onMount(context, () => {});
  return <p>Hello</p>;
}
```

Or use a function declaration with `this`:

<!-- legacy-this -->
```jsx
function View() {
  onMount(this, () => {});
  return <p>Hello</p>;
}
```

The explicit argument is easier to follow and works with arrow functions.

### How do I pass children to a component?

Put them between the tags:

```jsx
<Card>
  <p>Hello</p>
</Card>;
```

Inside the component, render `props.children`. See [Components](./components.md#props-and-children).

### Where can I look up a pattern quickly?

Use the [Cheatsheet](./cheatsheet.md). It covers state, derived state, effects, lists, stores, refs, router, translate, HTTP, and common mistakes.
