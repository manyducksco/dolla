# Getting started

## Requirements

Dolla renders directly to the DOM and targets modern browsers. You need:

- A browser environment with `document` (Dolla is a client-side framework, not an SSR framework).
- ES2022 support.
- A bundler or dev server to resolve npm imports. [Vite](https://vite.dev) is the recommended choice and is required for the optional Vite plugin and HMR.

`html` templates do not need a compiler. JSX does, so add the TypeScript/esbuild JSX settings if you prefer JSX.

## Install

```sh
npm install @manyducks.co/dolla
```

If you are using the Vite plugin, Vite is a peer dependency:

```sh
npm install -D vite
```

## Minimal app

Create an HTML file with a mount point and a module entry:

```html
<!-- index.html -->
<!doctype html>
<html>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

```js
// src/main.js
import { html, createAtom, createRoot } from "@manyducks.co/dolla";

function App() {
  const [count, setCount] = createAtom(0);

  return html`
    <main>
      <p>Count: ${count}</p>
      <button onClick=${() => setCount((c) => c + 1)}>+1</button>
    </main>
  `;
}

await createRoot("#app").mount(App);
```

`createRoot` accepts either a selector or an `Element`. `mount` is async because plugins are awaited before the app is mounted.

## Run it with Vite

Add scripts to `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

Then run:

```sh
npm run dev
```

## The one rule to remember

Views run once. Values update because you pass **getters** into the template:

```js
const [count, setCount] = createAtom(0);

html`<p>${count}</p>`;   // reactive: the getter is tracked
html`<p>${count()}</p>`; // static: the current value is baked in
```

If you call a getter yourself, wrap it in another getter when you need reactivity:

```js
html`<p>${() => count() * 2}</p>`;
```

See [Mental model](./concepts.md) and [Templates](./templates.md) for the full explanation.

## TypeScript and JSX

Dolla ships with TypeScript types. For JSX, set the automatic runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Then you can use JSX instead of `html`:

```jsx
function Hello({ name }) {
  return <p>Hello, {name}!</p>;
}
```

See [JSX setup](./jsx.md) and [Templates](./templates.md).

## Plugins

Plugins extend the root context before the app mounts. The router and translate modules are plugins:

```js
import { createRoot } from "@manyducks.co/dolla";
import { createRouter } from "@manyducks.co/dolla/router";

const routes = [
  { path: "/", view: HomePage },
];

await createRoot("#app")
  .plugin(createRouter({ routes }))
  .mount(App);
```

A plugin is a function that receives the root context:

```js
const myPlugin = (context) => {
  context.myValue = "available everywhere";
};
```

Plugins may be async; `mount` waits for them.

## Next steps

- [Mental model](./concepts.md) — why views run once and how updates flow
- [Templates](./templates.md) — `html` syntax, props, children, events
- [Reactivity](./reactivity.md) — atoms, `compose`, effects, batching
- [Components](./components.md) — views, stores, control flow, portals
- [Glossary](./glossary.md) — definitions for the terms used in these docs
- [FAQ](./faq.md) — common questions and gotchas
- [Router](../src/router/README.md) — the first module most apps need

## Troubleshooting

**My value never updates.** You probably called the getter: `${count()}` instead of `${count}`. See [Templates](./templates.md#interpolation).

**My app doesn't mount.** `mount` is async. Use `await createRoot(...).mount(...)`, and check that the selector matches an element.

**My styles are missing.** A `css` template must be attached to an element through `class` (or through `styled`), not just created. See [CSS](./css.md).

**HMR does a full reload.** Check that the Vite plugin is configured in `vite.config.js`. See [HMR](./hmr.md).
