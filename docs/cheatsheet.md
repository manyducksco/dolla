# Cheatsheet

Short answers for common tasks. Every snippet assumes the relevant imports from `@manyducks.co/dolla` unless an import is shown.

Snippets that use `context` are called inside a view or store, for example `function View(props, context) { ... }`.

## State

```jsx
const [getCount, setCount] = createAtom(0);

setCount(1);
setCount((count) => count + 1);

<p>{getCount}</p>
```

## Derived state

```jsx
const getDoubled = compose(() => getCount() * 2);

<p>{getDoubled}</p>
```

## Read without tracking

```js
const current = peek(getCount);
```

## Batch updates

```js
batch(() => {
  setCount(1);
  setName("Alice");
});
```

## Run an effect

```jsx
onEffect(context, () => {
  const id = setInterval(() => setCount((count) => count + 1), 1000);
  return () => clearInterval(id);
});
```

## Run code on mount and cleanup

```jsx
function Panel(props, context) {
  onMount(context, () => {
    // The DOM is mounted.
  });

  onCleanup(context, () => {
    // The view is being disposed.
  });

  return <div>Panel</div>;
}
```

## Show content conditionally

```jsx
{showIf(getIsLoading, <p>Loading...</p>, <p>Ready</p>)}
{hideIf(getIsLoading, <p>Content</p>, <p>Loading...</p>)}
```

## Render a reactive list

```jsx
<ul>
  {forEach(
    getItems,
    (item) => item.id,
    (getItem, getIndex) => (
      <li>{getIndex}: {() => getItem().text}</li>
    ),
  )}
</ul>
```

## Share state with a store

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

## Put a value on the context

```jsx
function Parent(props, context) {
  const [getUser] = createAtom({ name: "Alice" });
  context.user = getUser;
  return <Child />;
}

function Child(props, context) {
  return <p>{() => context.user().name}</p>;
}
```

## Access a DOM node

```jsx
const inputRef = createRef();

<input ref={inputRef} />;

onMount(context, () => inputRef().focus());
```

## Pass a reactive prop

```jsx
function Child(props) {
  return <p>{props.name}</p>;
}

<Child name={getUserName} />;
```

For logic, use `unwrap(props.name)`.

In TypeScript, type the props as `ReactiveProps<Props>`. Use `ReactiveProps<Props, "id">` to keep `id` plain. Function-typed props stay callable.

## Add a CSS class

```jsx
const card = css`
  padding: 16px;
  border: 1px solid #ddd;
`;

<section class={card}>...</section>;
```

## Create a styled component

```jsx
const Button = styled.button`
  padding: 8px 12px;
`;

<Button onClick={save}>Save</Button>;
```

## Navigate with the router

```jsx
import { createRouter, getRouter, Outlet } from "@manyducks.co/dolla/router";

function App() {
  return <main><Outlet /></main>;
}

function UserPage(props, context) {
  const router = getRouter(context);
  return <p>User: {() => router.params().id}</p>;
}

await createRoot("#app")
  .plugin(createRouter({
    routes: [
      { path: "/", view: HomePage },
      { path: "/users/{#id}", view: UserPage },
    ],
  }))
  .mount(App);
```

## Translate a string

```jsx
import { createTranslate, getTranslate } from "@manyducks.co/dolla/translate";

function App(props, context) {
  const { t } = getTranslate(context);
  return <button>{t("helloButtonLabel")}</button>;
}

await createRoot("#app")
  .plugin(createTranslate({
    locale: "en-US",
    translations: {
      "en-US": { helloButtonLabel: "Hello" },
    },
  }))
  .mount(App);
```

## Make an HTTP request

```js
import { HTTP } from "@manyducks.co/dolla/http";

const http = new HTTP();

const user = await http.get("/api/user").json();
const validated = await http.get("/api/user").json(UserSchema);
```

## Show a loading state for async data

```jsx
const [getUser, setUser] = createAtom(null);
const [getLoading, setLoading] = createAtom(true);

async function loadUser() {
  setLoading(true);
  setUser(await http.get("/api/user").json());
  setLoading(false);
}

<div>
  {showIf(
    getLoading,
    <p>Loading...</p>,
    <UserView user={getUser} />,
  )}
</div>;
```

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Value never updates | `{getCount()}` | `{getCount}` or `{() => getCount()}` |
| List item text never updates | `{getItem().text}` | `{() => getItem().text}` |
| Prop getter throws | Parent passed a static value, child calls `props.name()` | Pass `name={getUserName}` or use `unwrap(props.name)` |
| `this` is undefined | Arrow function used with `this` | Use `(props, context)` or a function declaration |
| Route params never update | `{router.params().id}` | `{() => router.params().id}` |
| App renders nothing | `mount` not awaited or selector missing | `await createRoot("#app").mount(App)` |
| Styles are missing | `css` template created but not attached | Pass it to `class` or use `styled` |

## More

- [Templates](./templates.md)
- [Reactivity](./reactivity.md)
- [Components](./components.md)
- [Hooks](./hooks.md)
- [HTML templates](./html.md)
- [Coming from React](./from-react.md)
