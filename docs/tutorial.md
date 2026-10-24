# Build your first Dolla app

This tutorial builds a small todo app in about ten minutes. It assumes the Vite + JSX setup from [Getting started](./getting-started.md). If you prefer no build step, the same app works with the [`html` helper](./html.md); only the template syntax changes.

Each step introduces one idea and links to the reference page for the full details.

## 1. Mount a view

Start with a static view and mount it into `#app`.

```jsx
import { createRoot } from "@manyducks.co/dolla";

function App() {
  return <h1>Todo</h1>;
}

await createRoot("#app").mount(App);
```

`createRoot` accepts a selector or an element. `mount` is async because it awaits plugins before mounting the app.

**Why it works:** a view is a function that returns markup. It runs once when it mounts. See [App root](./root.md).

## 2. Add state

Add an atom and a button. Name the read half `getCount` so it is obvious which half you are passing around.

```jsx
import { createAtom, createRoot } from "@manyducks.co/dolla";

function App() {
  const [getCount, setCount] = createAtom(0);

  return (
    <main>
      <p>Count: {getCount}</p>
      <button onClick={() => setCount((count) => count + 1)}>+1</button>
    </main>
  );
}

await createRoot("#app").mount(App);
```

`{getCount}` passes the getter, so the paragraph updates. `{getCount()}` would pass the current number and stay static.

**Why it works:** the view runs once. The framework tracks the getter inside the template and updates that text node when the atom changes. See [Reactivity](./reactivity.md).

## 3. Derive a value

Replace the counter with a todo list and derive the number of remaining items.

```jsx
import { compose, createAtom, createRoot } from "@manyducks.co/dolla";

function App() {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  return (
    <main>
      <h1>Todo</h1>
      <p>{getRemaining} remaining</p>
    </main>
  );
}

await createRoot("#app").mount(App);
```

`compose` creates a lazy derived getter. It recomputes when `getItems` changes and the value is read.

**Why it works:** `getRemaining` tracks `getItems` automatically. You never have to list dependencies. See [Derived state](./reactivity.md#derived-state-with-compose).

## 4. Render a list

Use `repeat` for a reactive, keyed list. The render callback receives item and index **getters**.

```jsx
import { compose, createAtom, createRoot, repeat, showIf } from "@manyducks.co/dolla";

function App() {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  const toggle = (id) =>
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );

  return (
    <main>
      <h1>Todo</h1>
      <p>{getRemaining} remaining</p>
      <ul>
        {repeat(
          getItems,
          (item) => item.id,
          (getItem) => (
            <li onClick={() => toggle(getItem().id)}>
              {showIf(() => getItem().done, "✅", "⬜")} {() => getItem().text}
            </li>
          ),
        )}
      </ul>
    </main>
  );
}

await createRoot("#app").mount(App);
```

The key function receives plain values. The render function receives getters, so read them inside another getter: `{() => getItem().text}`. Writing `{getItem().text}` would evaluate once.

**Why it works:** items with the same key reuse their DOM nodes when the list changes. See [`repeat`](./components.md#repeat).

## 5. Share state with a store

Move the todo state into a store so more than one view can use it. The parent creates it with `addStore`; children retrieve it with `getStore`.

```jsx
import {
  addStore,
  compose,
  createAtom,
  createRoot,
  repeat,
  getStore,
  showIf,
} from "@manyducks.co/dolla";

function TodoStore() {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  const toggle = (id) =>
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );

  return { getItems, getRemaining, toggle };
}

function TodoList(props, context) {
  const store = getStore(context, TodoStore);

  return (
    <section>
      <h1>Todo</h1>
      <p>{store.getRemaining} remaining</p>
      <ul>
        {repeat(
          store.getItems,
          (item) => item.id,
          (getItem) => (
            <li onClick={() => store.toggle(getItem().id)}>
              {showIf(() => getItem().done, "✅", "⬜")} {() => getItem().text}
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function App(props, context) {
  addStore(context, TodoStore);
  return <TodoList />;
}

await createRoot("#app").mount(App);
```

Notice the second argument to the views: `function TodoList(props, context)`. The context is the wiring harness. `this` also works, but the explicit argument is easier to follow and works with arrow functions.

**Why it works:** a store is created once per subtree and shared by every descendant. See [Stores](./components.md#stores).

## 6. Pass a reactive prop

Props are captured when a child mounts. Pass a getter when the prop should change.

```jsx
function Remaining(props) {
  return <p>{props.count} remaining</p>;
}

function TodoList(props, context) {
  const store = getStore(context, TodoStore);

  return (
    <section>
      <h1>Todo</h1>
      <Remaining count={store.getRemaining} />
      {/* ... */}
    </section>
  );
}
```

`props.count` is a getter because the parent passed `store.getRemaining`. Interpolating `{props.count}` stays reactive. If you need the value in logic, use `unwrap(props.count)`.

If the parent passes a plain value (`count={0}`), the child receives a number. Calling `props.count()` would throw. See [Props and the run-once model](./templates.md#props-and-the-run-once-model).

## 7. Run code on mount and when state changes

Add an input, focus it on mount, and persist the list when it changes. These are the new pieces; the final app below puts them together.

```jsx
import { compose, createAtom, createRef, onEffect, onMount } from "@manyducks.co/dolla";

function AddTodo(props, context) {
  const [getText, setText] = createAtom("");
  const inputRef = createRef();

  onMount(context, () => {
    inputRef().focus();
  });

  const submit = (event) => {
    event.preventDefault();
    const text = getText().trim();
    if (!text) return;
    props.onAdd(text);
    setText("");
  };

  return (
    <form onSubmit={submit}>
      <input
        ref={inputRef}
        value={getText}
        onInput={(event) => setText(event.target.value)}
        placeholder="What needs doing?"
      />
      <button type="submit">Add</button>
    </form>
  );
}

function TodoStore(props, context) {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  const addItem = (text) =>
    setItems((items) => [...items, { id: Date.now(), text, done: false }]);

  const toggle = (id) =>
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );

  onEffect(context, () => {
    localStorage.setItem("todos", JSON.stringify(getItems()));
  });

  return { getItems, getRemaining, addItem, toggle };
}
```

`onMount` runs after the view's DOM is mounted, so the input exists. `onEffect` runs immediately when the store's context mounts and re-runs whenever `getItems` changes.

`onEffect` may return a cleanup function. `onMount` does not use its return value; use `onCleanup` for cleanup that is not tied to an effect.

See [Hooks](./hooks.md) and [Effects](./effects.md).

## 8. Add CSS

Dolla has two CSS helpers. `css` creates a scoped class; `styled` creates a component with the class attached.

```jsx
import { css, styled } from "@manyducks.co/dolla";

const page = css`
  max-width: 32rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
`;

const Row = styled.li`
  cursor: pointer;
  padding: 0.5rem 0;
`;
```

Use them in the view:

```jsx
<section class={page}>
  <ul>
    {repeat(
      store.getItems,
      (item) => item.id,
      (getItem) => (
        <Row onClick={() => store.toggle(getItem().id)}>
          {showIf(() => getItem().done, "✅", "⬜")} {() => getItem().text}
        </Row>
      ),
    )}
  </ul>
</section>
```

See [CSS](./css.md) and [Styled components](./styled.md).

## The complete app

```jsx
import {
  addStore,
  compose,
  createAtom,
  createRef,
  createRoot,
  css,
  repeat,
  getStore,
  onEffect,
  onMount,
  showIf,
  styled,
} from "@manyducks.co/dolla";

const page = css`
  max-width: 32rem;
  margin: 2rem auto;
  font-family: system-ui, sans-serif;
`;

const Row = styled.li`
  cursor: pointer;
  padding: 0.5rem 0;
`;

function TodoStore(props, context) {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  const addItem = (text) =>
    setItems((items) => [...items, { id: Date.now(), text, done: false }]);

  const toggle = (id) =>
    setItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    );

  onEffect(context, () => {
    localStorage.setItem("todos", JSON.stringify(getItems()));
  });

  return { getItems, getRemaining, addItem, toggle };
}

function AddTodo(props, context) {
  const [getText, setText] = createAtom("");
  const inputRef = createRef();

  onMount(context, () => inputRef().focus());

  const submit = (event) => {
    event.preventDefault();
    const text = getText().trim();
    if (!text) return;
    props.onAdd(text);
    setText("");
  };

  return (
    <form onSubmit={submit}>
      <input
        ref={inputRef}
        value={getText}
        onInput={(event) => setText(event.target.value)}
        placeholder="What needs doing?"
      />
      <button type="submit">Add</button>
    </form>
  );
}

function Remaining(props) {
  return <p>{props.count} remaining</p>;
}

function TodoList(props, context) {
  const store = getStore(context, TodoStore);

  return (
    <section class={page}>
      <h1>Todo</h1>
      <Remaining count={store.getRemaining} />
      <ul>
        {repeat(
          store.getItems,
          (item) => item.id,
          (getItem) => (
            <Row onClick={() => store.toggle(getItem().id)}>
              {showIf(() => getItem().done, "✅", "⬜")} {() => getItem().text}
            </Row>
          ),
        )}
      </ul>
      <AddTodo onAdd={store.addItem} />
    </section>
  );
}

function App(props, context) {
  addStore(context, TodoStore);
  return <TodoList />;
}

await createRoot("#app").mount(App);
```

## Where next

- [Components](./components.md) — views, stores, and control flow in depth
- [Hooks](./hooks.md) — lifecycle, context, and store hooks
- [Router](./../src/router/README.md) — add pages and layouts
- [Translate](./../src/translate/README.md) — add another language
- [HTTP client](./../src/http/README.md) — load data from an API
- [Cheatsheet](./cheatsheet.md) — quick lookups while you build
