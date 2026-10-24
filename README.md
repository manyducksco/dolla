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
- 🎨 **CSS-in-JS** — a `css` helper for quick inline classes and `styled.*` elements for easy composition
- 🧊 **Keep-alive conditionals** — optionally hide content instead of unmounting it
- 🏗 **Buildless templates** — use the `html` helper instead of JSX, with no template compiler
- 🐛 **Debug logging** — colored, taggable, filterable
- ⏱ **Temporal helpers** — `debounce` and `throttle`

### Modules

- 🔀 **Router** — nested routes, lazy loading, guards, preload, error views
- 🌍 **i18n** — pluralization, formatting, async translation loading
- 📡 **HTTP client** — middleware pipeline, typed responses
- 📜 **Virtual list** — recycled DOM pool, infinite scroll, sticky headers
- 🔥 **HMR** — hot module replacement via Vite plugin

## Installation

```sh
npm install @manyducks.co/dolla
```

Dolla targets modern browsers with DOM and ES2022 support. See [Getting started](./docs/getting-started.md) for project setup and the optional Vite/JSX configuration.

## Quick start

A counter with reactive state, lifecycle hooks, and conditional rendering:

```js
import { html, createAtom, createRoot, compose, onEffect, showIf } from "@manyducks.co/dolla";

function Counter() {
  const [count, setCount] = createAtom(0);
  const isEven = compose(() => count() % 2 === 0);

  onEffect(this, () => console.log("count:", count()));

  return html`
    <div>
      <p>Count: ${count}</p>
      <button onClick=${() => setCount((c) => c + 1)}>+</button>
      <button onClick=${() => setCount((c) => c - 1)}>-</button>
      ${showIf(isEven, html`<p>That's even!</p>`)}
    </div>
  `;
}

await createRoot("#app").mount(Counter);
```

`mount` is async because plugins are awaited before the app is mounted.

## Documentation

New here? Read **[Getting started](./docs/getting-started.md)**, then **[Mental model](./docs/concepts.md)**, **[Templates](./docs/templates.md)**, and **[Reactivity](./docs/reactivity.md)**.

| Area                                       | Description                                                      |
| ------------------------------------------ | ---------------------------------------------------------------- |
| [Getting started](./docs/getting-started.md) | Install, project setup, first app, JSX/TS, plugins               |
| [App root](./docs/root.md)                 | `createRoot`, plugins, async mount, unmount                      |
| [Mental model](./docs/concepts.md)         | Signals, run-once views, context, update timing                  |
| [Templates](./docs/templates.md)           | `html` syntax, props, children, events, attributes, JSX          |
| [Reactivity](./docs/reactivity.md)         | Signals — atoms, compose, effects, batch, peek                   |
| [Effects](./docs/effects.md)               | Auto-tracking vs deps-array, lifecycle-scoped effects            |
| [Components](./docs/components.md)         | Views, Stores, control flow helpers, context, portals            |
| [CSS](./docs/css.md)                       | CSS-in-JS with scoped classes, reactive variables, composition   |
| [Styled components](./docs/styled.md)      | `styled.*`, naming, `as`, composition, props                     |
| [Transitions](./docs/transitions.md)       | Enter/exit animations with the Web Animations API                |
| [Refs](./docs/refs.md)                     | Direct DOM access with createRef                                 |
| [Hooks](./docs/hooks.md)                   | Lifecycle, context, store, and visibility hooks                  |
| [Debugging](./docs/debugging.md)           | Loggers, levels, filters, and debug mode                         |
| [Utilities](./docs/utilities.md)           | debounce, throttle, sleep                                        |
| [Advanced internals](./docs/advanced.md)   | Types, `createMarkup`/`render`, custom nodes                     |
| [Glossary](./docs/glossary.md)             | Definitions for the terms used throughout the docs               |
| [FAQ](./docs/faq.md)                       | Common questions and gotchas                                     |
| [HMR](./docs/hmr.md)                       | Hot module replacement with Vite                                 |
| [JSX setup](./docs/jsx.md)                 | Configuring JSX with Dolla                                       |
| [Docs contributing](./docs/contributing.md) | Conventions for examples, terminology, and docs checks           |
| [Router](./src/router/README.md)           | Client-side SPA routing with nested routes, guards, lazy loading |
| [Translate](./src/translate/README.md)     | i18n with pluralization, formatting, async loading               |
| [HTTP Client](./src/http/README.md)        | Middleware-based HTTP client                                     |
| [Virtual List](./src/virtual/README.md)    | High-performance virtual scrolling with sticky headers           |

## Sub-packages

Dolla is modular. Import only what you need:

| Import path                     | Includes                                                      |
| ------------------------------- | ------------------------------------------------------------- |
| `@manyducks.co/dolla`           | Core — signals, markup, components, lifecycle, CSS, utilities |
| `@manyducks.co/dolla/router`    | Client-side router with nested routes                         |
| `@manyducks.co/dolla/translate` | i18n translation system                                       |
| `@manyducks.co/dolla/http`      | Middleware-based HTTP client                                  |
| `@manyducks.co/dolla/virtual`   | Virtual scrolling list                                        |

See [bundlephobia](https://bundlephobia.com/package/@manyducks.co/dolla) for current package sizes.

## How does it work?

Dolla is built around signals for state management and reactive DOM updates. Components are "rendered" just once, then all changes thereafter are caused directly by updates to the app's state. State is held in containers called atoms.

```js
import { createAtom } from "@manyducks.co/dolla";

const [count, setCount] = createAtom(1);

count(); // returns the current value
setCount(2); // replaces the atom's value
```

Dolla includes helpers and signal-based machinery to translate these values to DOM nodes and update them when state changes.

```js
import { createAtom, html } from "@manyducks.co/dolla";

function MyView() {
  const [count, setCount] = createAtom(1);

  const increment = () => setCount((current) => current + 1);

  return html`
    <section>
      <header>This is the count.</header>
      <p>${count}</p>
      <button onClick=${increment}>+</button>
    </section>
  `;
}
```

Notice that `count` is passed directly into the HTML template. We're not calling the function to get the value inside the view. Dolla will do that internally, tracking the value and updating the DOM when we call `setCount`.

A few rules to remember:

- The component function runs once (no re-renders). All runtime changes happen through atoms.
- Pass getters, not values. Writing `${count}` stays reactive; writing `${count()}` is evaluated once and won't update.
- DOM updates are batched as a microtask. Use [`batch`](./docs/reactivity.md) to group signal changes and trigger a single update.
- Getters are tracked inside `compose`, `createEffect` / `onEffect`, and template interpolation. Use [`peek`](./docs/reactivity.md) to read without tracking.

## Stores

A Store shares state across views in the same subtree. Parent calls `addStore` to create it, children call `getStore` to retrieve it.

```js
import { html, createAtom, createRoot, compose, addStore, getStore, showIf, forEach } from "@manyducks.co/dolla";

function TodoStore() {
  const [items, setItems] = createAtom([
    { id: 1, text: "Learn Dolla", done: false },
    { id: 2, text: "Build something", done: false },
  ]);
  const addItem = (text) => setItems((list) => [...list, { id: Date.now(), text, done: false }]);
  const toggle = (id) => setItems((list) => list.map((i) => (i.id === id ? { ...i, done: !i.done } : i)));
  return { items, addItem, toggle };
}

function App() {
  addStore(this, TodoStore);
  return html`<${TodoList} />`;
}

function TodoList() {
  const store = getStore(this, TodoStore);

  return html`
    <p>${compose(() => store.items().filter((i) => !i.done).length)} remaining</p>
    <ul>
      ${forEach(
        store.items,
        (item) => item.id,
        (item) => html`
          <li onClick=${() => store.toggle(item().id)}>${showIf(() => item().done, "✅")} ${() => item().text}</li>
        `,
      )}
    </ul>
    <button onClick=${() => store.addItem("New task")}>Add</button>
  `;
}

await createRoot("#app").mount(App);
```

## Derived state

Only a single number changes below, but three values update in sync — `compose` chains automatically track their dependencies.

```js
import { html, createRoot, createAtom, compose } from "@manyducks.co/dolla";

function Converter() {
  const [celsius, setCelsius] = createAtom(0);

  const fahrenheit = compose(() => (celsius() * 9) / 5 + 32);

  const description = compose(() => {
    const f = fahrenheit();
    if (f <= 32) return "Freezing ❄️";
    if (f >= 90) return "Hot! 🔥";
    return "Moderate 🌤️";
  });

  return html`
    <div>
      <input type="number" value=${celsius} oninput=${(e) => setCelsius(e.target.valueAsNumber)} />
      <p>Celsius: ${celsius}°C</p>
      <p>Fahrenheit: ${fahrenheit}°F</p>
      <p>Condition: ${description}</p>
    </div>
  `;
}

await createRoot("#app").mount(Converter);
```

## JSX

Dolla supports JSX as an alternative to the `html` helper. See [Templates](./docs/templates.md) and [JSX setup](./docs/jsx.md) for details.

Set `jsxImportSource` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Then write components with JSX instead of `html`:

```jsx
function Hello({ name }) {
  return <p>Hello, {name}!</p>;
}
```

## No build step

You can skip the template compiler entirely and use `html` tagged templates, which work directly in the browser. You will still need a bundler or dev server to resolve npm imports and to enable HMR.

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
