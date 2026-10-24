# Coming from React

Dolla borrows React's component shape, but the execution model is different. Once that difference clicks, most of the API is obvious.

## The one big difference

React re-runs your component function when state changes. Dolla runs it **once** when the view mounts. State changes update the exact DOM nodes that depend on them.

```jsx
// React: this function runs again on every count change.
function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>{count}</button>;
}
```

```jsx
// Dolla: this function runs once. The button text updates in place.
function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);
  return <button onClick={() => setCount((count) => count + 1)}>{getCount}</button>;
}
```

There is no virtual DOM, no diffing, and no re-render. That is why there is no `useCallback` or `useMemo` for referential stability.

## State

| React | Dolla |
|---|---|
| `const [count, setCount] = useState(0)` | `const [getCount, setCount] = createAtom(0)` |
| `count` | `getCount` (a getter) |
| `{count}` | `{getCount}` |
| `setCount(1)` | `setCount(1)` |
| `setCount(c => c + 1)` | `setCount(c => c + 1)` |

```jsx
const [getCount, setCount] = createAtom(0);

<p>{getCount}</p>;
<button onClick={() => setCount((count) => count + 1)}>+1</button>;
```

The `get` prefix is a convention, not a requirement. It makes it obvious which half you are passing to the template.

## Derived state

| React | Dolla |
|---|---|
| `useMemo(() => count * 2, [count])` | `compose(() => getCount() * 2)` |
| Recomputes on render | Recomputes lazily when a dependency changes and the value is read |

```jsx
const getDoubled = compose(() => getCount() * 2);

<p>{getDoubled}</p>;
```

You do not list dependencies. `compose` tracks the getters it reads.

## Effects

| React | Dolla |
|---|---|
| `useEffect(fn, deps)` | `onEffect(context, fn)` |
| Cleanup returned from the effect | Cleanup returned from the effect |
| Runs after paint | Runs when the view's context mounts, then on tracked changes |

```jsx
function Timer(props, context) {
  const [getElapsed, setElapsed] = createAtom(0);

  onEffect(context, () => {
    const id = setInterval(() => setElapsed((elapsed) => elapsed + 1), 1000);
    return () => clearInterval(id);
  });

  return <p>{getElapsed}s</p>;
}
```

`onEffect` auto-tracks the getters read inside it. A deps-array form exists for explicit control:

```js
onEffect(context, (count, name) => {
  console.log(count, name);
}, [getCount, getName]);
```

Inside a view or store, `onEffect` is the usual choice. For effects outside the context tree, see [Standalone effects](./advanced.md#standalone-effects).

## Context

| React | Dolla |
|---|---|
| `createContext` + `useContext` | `addStore` / `getStore`, or a property on the context object |
| Provider re-renders consumers | Context is inherited through the view tree; no provider component |

```jsx
function TodoStore() {
  const [getItems, setItems] = createAtom([]);
  return { getItems, setItems };
}

function App(props, context) {
  addStore(context, TodoStore);
  return <TodoList />;
}

function TodoList(props, context) {
  const store = getStore(context, TodoStore);
  return <p>{() => store.getItems().length} items</p>;
}
```

For a one-off value, set it on the context:

```jsx
function Parent(props, context) {
  context.user = getUser;
  return <Child />;
}

function Child(props, context) {
  return <p>{() => context.user().name}</p>;
}
```

## Refs

| React | Dolla |
|---|---|
| `useRef()` | `createRef()` |
| `ref.current` | `ref()` |
| `useEffect(() => ref.current.focus(), [])` | `onMount(context, () => ref().focus())` |

```jsx
function AutoFocus(props, context) {
  const inputRef = createRef();

  onMount(context, () => inputRef().focus());

  return <input ref={inputRef} />;
}
```

`createRef` returns a callable container. Call it with no arguments to read; the `ref` prop calls it with the DOM node when the element mounts.

## Props

React passes a new props object on every render. Dolla captures props when the child mounts. To pass dynamic data, pass a getter.

```jsx
// Parent
<Greeting name={getUserName} />

// Child
function Greeting(props) {
  return <p>Hello, {props.name}!</p>;
}
```

`props.name` is a getter in the child because the parent passed a getter. If you need the value in logic, use `unwrap(props.name)`.

In TypeScript, type reactive props as `Getter<T>`. Use `MaybeGetter<T>` when a prop accepts either a plain value or a getter. See [TypeScript props](./templates.md#typescript-props).

If the parent passes a plain value (`name="Alice"`), the child receives a string. Calling `props.name()` would throw.

Because children do not re-render, replacing a static prop means creating a new child. Use `showIf` or a keyed `repeat` so the old instance is removed and a new one is mounted.

## Lists

| React | Dolla |
|---|---|
| `items.map(item => <li key={item.id}>{item.text}</li>)` | `repeat(getItems, item => item.id, getItem => <li>{() => getItem().text}</li>)` |
| `key` prop | Key function argument |
| Item is the value | Item is a getter |

```jsx
<ul>
  {repeat(
    getItems,
    (item) => item.id,
    (getItem) => <li>{() => getItem().text}</li>,
  )}
</ul>
```

Read item properties inside another getter: `{() => getItem().text}`. Writing `{getItem().text}` evaluates once.

## Conditionals

| React | Dolla |
|---|---|
| `{isLoading && <Spinner />}` | `{showIf(getIsLoading, <Spinner />)}` |
| `{isLoading ? <Spinner /> : <Content />}` | `{showIf(getIsLoading, <Spinner />, <Content />)}` |
| `switch` / nested ternaries | `branch(getStatus, { ... })` |

```jsx
{showIf(getIsLoading, <p>Loading...</p>, <p>Ready</p>)}
```

`&&` and ternaries evaluate the getter once. Use `showIf` or `branch` when the condition is reactive.

## Memoization

React needs `useCallback` and `useMemo` to keep references stable across renders. Dolla has no re-renders, so plain functions and values are stable by default.

```jsx
// No useCallback needed.
const increment = () => setCount((count) => count + 1);
```

Use `compose` when you need a cached derived value, not for referential stability.

## Async data

React has Suspense and thrown promises. Dolla models async work as state.

```jsx
const [getUser, setUser] = createAtom(null);
const [getLoading, setLoading] = createAtom(true);

async function loadUser() {
  setLoading(true);
  setUser(await http.get("/api/user").json());
  setLoading(false);
}

{showIf(
  getLoading,
  <p>Loading...</p>,
  <UserView user={getUser} />,
)}
```

The router has `preload`, `progress`, lazy routes, and `errorView` for route-level async.

## CSS

React commonly uses CSS modules, CSS-in-JS libraries, or utility classes. You can keep using CSS modules or plain class strings; the `css` helper is optional. Here is the convenience helper:

```jsx
const card = css`
  padding: 16px;
  border: 1px solid #ddd;
`;

<section class={card}>...</section>;
```

To style a component, attach the class in a view:

```jsx
const button = css`
  padding: 8px 12px;
`;

function Button(props) {
  return <button class={[button, props.class]} onClick={props.onClick}>{props.children}</button>;
}

<Button onClick={save}>Save</Button>;
```

## A full todo list

### React

```jsx
import { useState } from "react";

function Todo() {
  const [items, setItems] = useState([
    { id: 1, text: "Learn React", done: false },
  ]);
  const [text, setText] = useState("");

  const add = (event) => {
    event.preventDefault();
    setItems((current) => [...current, { id: Date.now(), text, done: false }]);
    setText("");
  };

  return (
    <main>
      <ul>
        {items.map((item) => (
          <li key={item.id}>{item.text}</li>
        ))}
      </ul>
      <form onSubmit={add}>
        <input value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit">Add</button>
      </form>
    </main>
  );
}
```

### Dolla

```jsx
import { createAtom, createRoot, repeat } from "@manyducks.co/dolla";

function Todo(props, context) {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
  ]);
  const [getText, setText] = createAtom("");

  const add = (event) => {
    event.preventDefault();
    setItems((current) => [...current, { id: Date.now(), text: getText(), done: false }]);
    setText("");
  };

  return (
    <main>
      <ul>
        {repeat(
          getItems,
          (item) => item.id,
          (getItem) => <li>{() => getItem().text}</li>,
        )}
      </ul>
      <form onSubmit={add}>
        <input value={getText} onInput={(event) => setText(event.target.value)} />
        <button type="submit">Add</button>
      </form>
    </main>
  );
}

await createRoot("#app").mount(Todo);
```

## Gotchas

| React habit | Dolla behavior |
|---|---|
| Writing `{count}` after `const [count, setCount] = useState(0)` | `{getCount}` after `const [getCount, setCount] = createAtom(0)` |
| Calling the getter in the template | Evaluates once and loses reactivity |
| Reading `props.name` in logic | It may be a getter; use `unwrap(props.name)` |
| Using `this` inside an arrow view | Use `(props, context)` instead |
| Expecting effects after paint | `onEffect` runs when the context mounts, then on tracked changes |
| Passing `key` as a prop | Pass a key function to `repeat` |
| Using `className`/`htmlFor` | `class`/`for` are the defaults; both forms work |

## Next steps

- [Mental model](./concepts.md) — the run-once model in detail
- [Templates](./templates.md) — JSX syntax and props
- [Reactivity](./reactivity.md) — atoms, `compose`, effects
- [Components](./components.md) — views, stores, and control flow
- [Cheatsheet](./cheatsheet.md) — quick lookups
