# 💲 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a research framework for trying out ideas. The goal is to create a full-featured framework that, first and foremost, provides the **best developer experience possible** out of the box. Low resource usage and small code size are secondary objectives.

Dolla is based on experience working with React, Angular, Vue, Svelte and Flutter, and is an amalgamation of all the things I liked and ways I wish things worked, all rolled into a single framework for making web-based SPAs. It's more than a toy and less than a production-ready workhorse. It's a labor of love. Use at your own joy and peril.

## Features

- 🚥 **Signals** — pinpoint reactive updates with no virtual DOM
- 📦 **Views** — reusable UI components that run once and update via signals
- 💾 **Stores** — share state across components via the context tree
- 🧩 **Context inheritance** — prototypal context chain for stores, debug, and arbitrary data
- 🎨 **CSS-in-JS** — scoped class names, reactive CSS variables, template composition
- 🔀 **Router** — nested routes, lazy loading, guards, preload, error views
- 🌍 **i18n** — pluralization, formatting, async translation loading
- 📡 **HTTP client** — middleware pipeline, typed responses
- 📜 **Virtual list** — recycled DOM pool, infinite scroll, sticky headers
- ⏱ **Temporal helpers** — `debounce` and `throttle`
- 🐛 **Debug logging** — colored, taggable, filterable
- 🔥 **HMR** — hot module replacement via Vite plugin

## Installation

```sh
npm install @manyducks.co/dolla
```

## Quick start

A counter with reactive state, lifecycle hooks, and conditional rendering:

```jsx
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

createRoot(document.body).mount(Counter);
```

## Documentation

| Area                                    | Description                                                      |
| --------------------------------------- | ---------------------------------------------------------------- |
| [Reactivity](./docs/reactivity.md)      | Signals — atoms, compose, effects, batch, peek                   |
| [Effects](./docs/effects.md)            | Auto-tracking vs deps-array, lifecycle-scoped effects            |
| [Components](./docs/components.md)      | Views, Stores, control flow helpers, context, portals            |
| [CSS](./docs/css.md)                    | CSS-in-JS with scoped classes, reactive variables, composition   |
| [Refs](./docs/refs.md)                  | Direct DOM access with createRef                                 |
| [Hooks](./docs/hooks.md)                | Lifecycle, context, store, and debug hooks reference             |
| [Utilities](./docs/utilities.md)        | debounce, throttle, subscribe, batch, peek, sleep                |
| [HMR](./docs/hmr.md)                    | Hot module replacement with Vite                                 |
| [Router](./src/router/README.md)        | Client-side SPA routing with nested routes, guards, lazy loading |
| [Translate](./src/translate/README.md)  | i18n with pluralization, formatting, async loading               |
| [HTTP Client](./src/http/README.md)     | Middleware-based HTTP client                                     |
| [Virtual List](./src/virtual/README.md) | High-performance virtual scrolling with sticky headers           |
| [JSX](./docs/jsx.md)                    | Using JSX with Dolla                                             |

## Sub-packages

Dolla is modular. Import only what you need:

| Import path                     | Size           | Includes                                                      |
| ------------------------------- | -------------- | ------------------------------------------------------------- |
| `@manyducks.co/dolla`           | ~11 KB gzipped | Core — signals, markup, components, lifecycle, CSS, utilities |
| `@manyducks.co/dolla/router`    | +~4.7 KB       | Client-side router with nested routes                         |
| `@manyducks.co/dolla/translate` | +~1.2 KB       | i18n translation system                                       |
| `@manyducks.co/dolla/http`      | +~1.2 KB       | Middleware-based HTTP client                                  |
| `@manyducks.co/dolla/virtual`   | +~0 KB (lazy)  | Virtual scrolling list                                        |

## Stores

A Store shares state across views in the same subtree. Parent calls `addStore` to create it, children call `getStore` to retrieve it.

```jsx
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

createRoot(document.body).mount(App);
```

A few points about how Dolla works:

- The component function runs once (no re-renders). All runtime changes happen through atoms.
- Pass getters, not values. Writing `${count}` in a template stays reactive; writing `${count()}` is evaluated once and won't update.
- DOM updates are batched as a microtask. Use [`batch`](./docs/reactivity.md) to group signal changes and trigger a single update.
- Getters are tracked inside `compose` and `createEffect`/`onEffect`. Use [`peek`](./docs/reactivity.md) to read without tracking.

## Derived state

Only a single number changes below, but three values update in sync — `compose` chains automatically track their dependencies.

```tsx
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

createRoot(document.body).mount(Converter);
```

## JSX

Set `jsxImportSource` in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Then write components with JSX instead of `html\`...\``:

```jsx
function Hello({ name }) {
  return <p>Hello, {name}!</p>;
}
```

## No build step

You can skip the bundler entirely and use `html` tagged templates. They work directly in the browser.

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
