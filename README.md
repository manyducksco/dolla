# 💲 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a personal JavaScript framework for creating web apps in a way I think is fun and interesting. It's based on my experience using React, Angular, Vue, Svelte and others and takes the best ideas from all of these and combines them into one fully featured, batteries-included web app framework.

Dolla is a research framework for trying out ideas. The goal is to create a full-featured framework that, first and foremost, provides the **best developer experience possible** out of the box. Low resource usage and small code size are secondary objectives. It's more than a toy and less than a production-ready workhorse. It's a labor of love. Use at your own joy and peril.

## Features

- 🚥 **Signals** — pinpoint reactive updates with no virtual DOM
- 📦 **Views** — reusable UI components that run once and update via signals
- 🧩 **Context** — each view exposes a context object that inherits values from the parent context
- 💾 **Stores** — shared-state-on-rails via the context tree
- 🎨 **CSS-in-JS** — a `css` helper for easy inline classes without a separate stylesheet
- 🏗 **Buildless templates** — use the `html` helper instead of JSX, with no template compiler
- 🐛 **Debug logging** — colored, taggable, filterable
- ⏱ **Temporal helpers** — `debounce` and `throttle`

### Modules

- 🔀 **Router** — nested routes, lazy loading, preload, error views
- 🌍 **i18n** — pluralization, formatting, async translation loading
- 📡 **HTTP client** — middleware pipeline, typed responses
- 📜 **Virtual list** — recycled DOM pool, infinite scroll, sticky headers
- 🔥 **HMR** — hot module replacement via Vite plugin

## Installation

```sh
npm install @manyducks.co/dolla
```

Dolla targets modern browsers with DOM and ES2022 support. See [Getting started](./docs/getting-started.md) for project setup and the JSX configuration.

## Quick start

A counter with reactive state, derived state, and conditional rendering:

```jsx
import { compose, createAtom, createRoot, showIf } from "@manyducks.co/dolla";

function Counter() {
  const [getCount, setCount] = createAtom(0);
  const getIsEven = compose(() => getCount() % 2 === 0);

  return (
    <div>
      <p>Count: {getCount}</p>
      <button onClick={() => setCount((count) => count + 1)}>+</button>
      <button onClick={() => setCount((count) => count - 1)}>-</button>
      {showIf(getIsEven, <p>That's even!</p>)}
    </div>
  );
}

await createRoot("#app").mount(Counter);
```

`mount` is async because plugins are awaited before the app is mounted.

> **No build step?** JSX needs a compiler. If you want to skip it, the [`html` helper](./docs/html.md) does the same thing with tagged templates. Everything else in these docs works the same way.

## Documentation

New here? Read **[Getting started](./docs/getting-started.md)**, then **[Build your first app](./docs/tutorial.md)**, **[Mental model](./docs/concepts.md)**, and **[Templates](./docs/templates.md)**.

### Start here

| Page                                         | Description                                                   |
| -------------------------------------------- | ------------------------------------------------------------- |
| [Getting started](./docs/getting-started.md) | Install, project setup, first app, JSX configuration, plugins |
| [Build your first app](./docs/tutorial.md)   | A 10-minute todo app that introduces one idea at a time       |
| [Mental model](./docs/concepts.md)           | Signals, run-once views, context, update timing               |
| [Templates](./docs/templates.md)             | JSX syntax, props, children, events, attributes               |
| [Reactivity](./docs/reactivity.md)           | Signals — atoms, compose, effects, batch, peek                |
| [Coming from React](./docs/from-react.md)    | Side-by-side mappings and gotchas                             |

### Build

| Page                                    | Description                                                      |
| --------------------------------------- | ---------------------------------------------------------------- |
| [Components](./docs/components.md)      | Views, stores, control-flow helpers, context, portals            |
| [Hooks](./docs/hooks.md)                | Lifecycle, context, and store hooks                              |
| [Effects](./docs/effects.md)            | `onEffect`, auto-tracking, cleanup                               |
| [CSS](./docs/css.md)                    | CSS-in-JS with scoped classes, reactive variables, composition   |
| [Transitions](./docs/transitions.md)    | Enter/exit animations with the Web Animations API                |
| [Refs](./docs/refs.md)                  | Direct DOM access with `createRef`                               |
| [Router](./src/router/README.md)        | Client-side SPA routing with nested routes, lazy loading         |
| [Translate](./src/translate/README.md)  | i18n with pluralization, formatting, async loading               |
| [HTTP client](./src/http/README.md)     | Middleware-based HTTP client                                     |
| [Virtual list](./src/virtual/README.md) | High-performance virtual scrolling with sticky headers           |

### Reference

| Page                                        | Description                                            |
| ------------------------------------------- | ------------------------------------------------------ |
| [Cheatsheet](./docs/cheatsheet.md)          | Task → code lookups for common jobs                    |
| [HTML templates](./docs/html.md)            | The buildless `html` helper and JSX equivalents        |
| [App root](./docs/root.md)                  | `createRoot`, plugins, async mount, unmount            |
| [Errors](./docs/errors.md)                  | Effect error reporting and `SignalError`              |
| [Debugging](./docs/debugging.md)            | Loggers, levels, filters, and debug mode               |
| [Utilities](./docs/utilities.md)            | debounce, throttle, sleep                              |
| [FAQ](./docs/faq.md)                        | Common questions and gotchas                           |
| [Glossary](./docs/glossary.md)              | Definitions for the terms used throughout the docs     |
| [Advanced internals](./docs/advanced.md)    | `@manyducks.co/dolla/internals`, custom nodes          |
| [HMR](./docs/hmr.md)                        | Hot module replacement with Vite                       |
| [Docs contributing](./docs/contributing.md) | Conventions for examples, terminology, and docs checks |

## Sub-packages

Dolla is modular. Import only what you need:

| Import path                     | Includes                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `@manyducks.co/dolla`           | Core — signals, markup, components, lifecycle, CSS, utilities |
| `@manyducks.co/dolla/internals` | Advanced rendering/context internals for integrations         |
| `@manyducks.co/dolla/router`    | Client-side router with nested routes                         |
| `@manyducks.co/dolla/translate` | i18n translation system                                       |
| `@manyducks.co/dolla/http`      | Middleware-based HTTP client                                  |
| `@manyducks.co/dolla/virtual`   | Virtual scrolling list                                        |

See [bundlephobia](https://bundlephobia.com/package/@manyducks.co/dolla) for current package sizes.

## How does it work?

Dolla is built around signals for state management and reactive DOM updates. Components are "rendered" just once, then all changes thereafter are caused directly by updates to the app's state. State is held in containers called atoms.

```js
import { createAtom } from "@manyducks.co/dolla";

const [getCount, setCount] = createAtom(1);

getCount(); // returns the current value
setCount(2); // replaces the atom's value
```

Dolla includes helpers and signal-based machinery to translate these values to DOM nodes and update them when state changes.

```jsx
import { createAtom } from "@manyducks.co/dolla";

function MyView() {
  const [getCount, setCount] = createAtom(1);

  const increment = () => setCount((count) => count + 1);

  return (
    <section>
      <header>This is the count.</header>
      <p>{getCount}</p>
      <button onClick={increment}>+</button>
    </section>
  );
}
```

Notice that `getCount` is passed directly into the JSX. We're not calling the function to get the value inside the view. Dolla will do that internally, tracking the value and updating the DOM when we call `setCount`.

A few rules to remember:

- The component function runs once (no re-renders). All runtime changes happen through atoms.
- Pass getters, not values. Writing `{getCount}` stays reactive; writing `{getCount()}` is evaluated once and won't update.
- DOM updates are batched as a microtask. Use [`batch`](./docs/reactivity.md) to group signal changes and trigger a single update.
- Getters are tracked inside `compose`, `onEffect`, and template interpolation. Use [`peek`](./docs/reactivity.md) to read without tracking.

## Stores

A Store shares state across views in the same subtree. Parent calls `addStore` to create it, children call `getStore` to retrieve it.

```jsx
import { addStore, compose, createAtom, createRoot, repeat, getStore, showIf } from "@manyducks.co/dolla";

function TodoStore() {
  const [getItems, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);

  const getRemaining = compose(() => getItems().filter((item) => !item.done).length);

  const addItem = (text) => setItems((items) => [...items, { id: Date.now(), text, done: false }]);

  const toggle = (id) =>
    setItems((items) => items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));

  return { getItems, getRemaining, addItem, toggle };
}

function App(props, context) {
  addStore(context, TodoStore);
  return <TodoList />;
}

function TodoList(props, context) {
  const store = getStore(context, TodoStore);

  return (
    <section>
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
      <button onClick={() => store.addItem("New task")}>Add</button>
    </section>
  );
}

await createRoot("#app").mount(App);
```

## Derived state

Only a single number changes below, but three values update in sync — `compose` chains automatically track their dependencies.

```jsx
import { compose, createAtom, createRoot } from "@manyducks.co/dolla";

function Converter() {
  const [getCelsius, setCelsius] = createAtom(0);

  const getFahrenheit = compose(() => (getCelsius() * 9) / 5 + 32);

  const getDescription = compose(() => {
    const fahrenheit = getFahrenheit();
    if (fahrenheit <= 32) return "Freezing ❄️";
    if (fahrenheit >= 90) return "Hot! 🔥";
    return "Moderate 🌤️";
  });

  return (
    <div>
      <input type="number" value={getCelsius} onInput={(event) => setCelsius(event.target.valueAsNumber)} />
      <p>Celsius: {getCelsius}°C</p>
      <p>Fahrenheit: {getFahrenheit}°F</p>
      <p>Condition: {getDescription}</p>
    </div>
  );
}

await createRoot("#app").mount(Converter);
```

## Templates

JSX is the default template style. Dolla ships the automatic JSX runtime, so set `jsxImportSource` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Then write views with JSX:

```jsx
function Hello(props) {
  return <p>Hello, {props.name}!</p>;
}
```

TypeScript users can type reactive props as `Getter<T>`, or `MaybeGetter<T>` when a prop accepts either a plain value or a getter. See [TypeScript props](./docs/templates.md#typescript-props).

See [Templates](./docs/templates.md) for props, children, events, attributes, and the run-once model.

## No build step

If you want to skip the JSX compiler, the `html` tagged template produces the same markup and works directly in the browser. You will still need a bundler or dev server to resolve npm imports and to enable HMR. See [HTML templates](./docs/html.md) for the complete `html` reference and a JSX equivalent for every construct.

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
