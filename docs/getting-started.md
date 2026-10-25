# Getting started

## Requirements

Dolla renders directly to the DOM and targets modern browsers. You need:

- A browser environment with `document` (Dolla is a client-side framework, not an SSR framework).
- ES2022 support.
- A bundler or dev server to resolve npm imports. [Vite](https://vite.dev) is the recommended choice and is required for the optional Vite plugin and HMR.

JSX is the default template style. It needs a compiler; Vite handles that for you. If you want no compiler, use the [`html` helper](./html.md) instead.

## Install

```sh
npm install @manyducks.co/dolla
```

## Create a project

```sh
npm create vite@latest my-dolla-app -- --template vanilla
cd my-dolla-app
npm install @manyducks.co/dolla
```

Replace the contents of `index.html` with a mount point:

```html
<!doctype html>
<html>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Add a `tsconfig.json` so the editor and Vite know how to transform JSX:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla",
    "allowJs": true,
    "checkJs": false,
    "strict": true,
    "skipLibCheck": true,
    "lib": ["DOM", "DOM.Iterable", "ESNext"]
  },
  "include": ["src"]
}
```

If you prefer to be explicit, add the same settings to `vite.config.js`:

```js
import { defineConfig } from "vite";
import dolla from "@manyducks.co/dolla/vite-plugin";

export default defineConfig({
  plugins: [dolla()],
  esbuild: {
    jsx: "automatic",
    jsxImportSource: "@manyducks.co/dolla",
  },
});
```

The Dolla plugin is optional; it enables HMR for views. See [HMR](./hmr.md).

## Minimal app

Create `src/main.jsx`:

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

Run it:

```sh
npm run dev
```

`createRoot` accepts either a selector or an `Element`. `mount` is async because plugins are awaited before the app is mounted.

## The one rule to remember

Views run once. Values update because you pass **getters** into the template:

```jsx
const [getCount, setCount] = createAtom(0);

<p>{getCount}</p>;   // reactive: the getter is tracked
<p>{getCount()}</p>; // static: the current value is baked in
```

If you call a getter yourself, wrap it in another getter when you need reactivity:

```jsx
<p>{() => getCount() * 2}</p>;
```

See [Values flow through getters](./concepts.md#values-flow-through-getters) for the full rule, including props, attributes, and logic.

Name getters with a `get` prefix. It makes the difference obvious:

```jsx
const [getItems, setItems] = createAtom([]);
```

See [Mental model](./concepts.md) and [Templates](./templates.md) for the full explanation.

## Choose your template style

**JSX** is the default in these docs. It has editor tooling, type-checking, and a familiar shape.

**The `html` helper** is the buildless alternative. It uses tagged templates and needs no compiler. A component looks like ``html`<p>Hello, ${props.name}!</p>` ``. Both styles produce the same markup and can be mixed in one app. See [HTML templates](./html.md) for the complete reference and a JSX equivalent for every construct.

## TypeScript

Dolla ships with TypeScript types. Use `.tsx` files and the `tsconfig.json` above. Type props explicitly. A static prop uses its plain type; a reactive prop is typed as `Getter<T>`:

```tsx
import type { Getter } from "@manyducks.co/dolla";

type Props = {
  name: Getter<string>;
  onSave: () => void;
};

function Greeting(props: Props) {
  return <p>Hello, {props.name}!</p>;
}

<Greeting name={getUserName} onSave={save} />;
```

If a prop accepts either a plain value or a getter, type it as `MaybeGetter<T>` and use `get()` where you need the value in logic. The framework does not wrap or unwrap props for you; see [Props follow their declared types](./concepts.md#props-follow-their-declared-types).

See [Templates](./templates.md) and [Advanced internals](./advanced.md#core-types).

## Plugins

Plugins extend the root context before the app mounts. The router and translate modules are plugins:

```jsx
import { createRoot } from "@manyducks.co/dolla";
import { createRouter } from "@manyducks.co/dolla/router";

const routes = [{ path: "/", view: HomePage }];

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

- [Build your first app](./tutorial.md) — a 10-minute todo app
- [Mental model](./concepts.md) — why views run once and how updates flow
- [Templates](./templates.md) — JSX syntax, props, children, events
- [Reactivity](./reactivity.md) — atoms, `compose`, effects, batching
- [Coming from React](./from-react.md) — mappings and gotchas
- [Cheatsheet](./cheatsheet.md) — quick lookups
- [Glossary](./glossary.md) — definitions for the terms used in these docs
- [FAQ](./faq.md) — common questions and gotchas
- [Router](./../src/router/README.md) — the first module most apps need

## Troubleshooting

**My value never updates.** You probably called the getter: `{getCount()}` instead of `{getCount}`. See [Values flow through getters](./concepts.md#values-flow-through-getters).

**My app doesn't mount.** `mount` is async. Use `await createRoot(...).mount(...)`, and check that the selector matches an element.

**My styles are missing.** A `css` template must be attached to an element through `class`, not just created. See [CSS](./css.md).

**My JSX doesn't compile.** Check `jsx` and `jsxImportSource` in `tsconfig.json`, or the `esbuild` settings in `vite.config.js`.

**HMR does a full reload.** Check that the Vite plugin is configured in `vite.config.js`. See [HMR](./hmr.md).

**`this` is undefined in my view.** Use the context argument: `function View(props, context)`. See [Components](./components.md#views).
