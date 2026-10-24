# Templates

Dolla has two templating styles that produce the same kind of markup: the `html` tagged template and JSX. You can use either one, and you can mix them.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Choosing a style

- **`html`** needs no compiler and works directly in the browser. This is the buildless option.
- **JSX** requires the TypeScript/esbuild JSX settings shown below. It is convenient if you already use JSX.

Both styles return the same `Markup` objects, so components written in one style can render components written in the other.

## Interpolation

The most important rule: pass a **getter**, not a value, when you want the DOM to update.

```js
const [count, setCount] = createAtom(0);

html`<p>${count}</p>`; // reactive: the getter is tracked
html`<p>${count()}</p>`; // static: the current value is baked in
```

If you need to transform the value, wrap the work in a getter or use `compose`:

```js
html`<p>${() => count() * 2}</p>`;
html`<p>${compose(() => count() * 2)}</p>`;
```

## What can be rendered

These values can be interpolated or returned from a view:

| Value                        | Behavior                                                                               |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `string`, `number`           | Rendered as a text node                                                                |
| `Markup`                     | Rendered as elements/components                                                        |
| `MarkupNode`                 | Mounted directly                                                                       |
| `Node`                       | Inserted into the DOM                                                                  |
| Getter (`() => value`)       | Tracked and rendered reactively                                                        |
| Array                        | Each item is processed, in order                                                       |
| `null`, `undefined`, `false` | Rendered as nothing                                                                    |
| `keepAlive(...)`             | Rendered as its content outside a keep-alive-aware helper such as `showIf` or `branch` |

An `html` template can contain multiple root nodes. A view can also return an array to render several roots:

```js
function Layout() {
  return [html`<header>Header</header>`, html`<main>Content</main>`];
}
```

## Elements

### Text and attributes

```js
const [name] = createAtom("Alice");

html`<p class="greeting" title=${name}>Hello, ${() => name()}!</p>`;
```

Attribute values are reactive when you pass a getter. The framework decides how to apply each key:

- If the key exists on the DOM element and is not an SVG element, it is set as a property.
- Boolean properties also set or remove the attribute.
- Everything else is set as an attribute.
- Keys starting with `prop:` are always set as properties.
- Keys starting with `attr:` or `:` are always set as attributes (lowercased).
- `for` is assigned to `htmlFor`.

```js
html`<input prop:value=${text} />`;
html`<div attr:data-id=${id}></div>`;
html`<div :data-id=${id}></div>`;
```

### Classes

`class` and `className` accept a string, an object of class names to booleans, an array of either, or one or more CSS templates:

```js
const [active] = createAtom(false);

html`<div class="card"></div>`;
html`<div class=${["card", { active }]}></div>`;
html`<div class=${cardTemplate}></div>`;
```

Object values can be getters when the class should toggle reactively. See [CSS](./css.md) for `css` templates, reactive variables, and `styled` components.

### Styles

`style` accepts a string, a style object, or an array of either:

```js
html`<div style=${{ color: "red", padding: 8 }}></div>`;
html`<div style="color: red; padding: 8px"></div>`;
```

Numeric values get a `px` suffix unless the property is unitless (for example `opacity`, `z-index`, `line-height`). Object values can be getters. CSS templates are not supported on `style`; pass them to `class` instead.

### Events

Use `onClick`, `onInput`, etc. Event names are case-insensitive, so lowercase `onclick` also works:

```js
html`<button onClick=${() => setCount((c) => c + 1)}>+1</button>`;
```

The value may also be an object with `handleEvent` and listener options:

```js
html`<button onClick=${{ handleEvent: onClick, once: true }}>Once</button>`;
```

### Refs

Pass `createRef()` or a callback to `ref`:

```js
const inputRef = createRef();

html`<input ref=${inputRef} />`;

html`<input
  ref=${(el) => {
    el.focus();
    return () => el.blur();
  }}
/>`;
```

See [Refs](./refs.md).

### SVG

SVG elements created through an `<svg>` tag use the SVG namespace. Nested `foreignObject` content switches back to HTML. SVG presentation attributes written in camelCase (`fillOpacity`, `strokeWidth`) are converted to kebab-case.

## Components

Components are interpolated with `${...}` in the tag position. Self-closing components use `/>`:

```js
html`<${Greeting} name="Alice" />`;
```

Children go between the tags, and a component closes with `<//>`:

```js
html`<${Card}><p>Hello</p><//>`;
```

Inside `Card`, the children are available as `props.children`.

### Multiple roots

A view may return multiple root nodes, either as an array or as an `html` template with more than one top-level element. The framework wraps them in a fragment.

## Props and the run-once model

This is the biggest difference from React-style frameworks.

A view runs **once** when it mounts. Its `props` object is captured at that moment. If the parent's state changes, the parent does not re-run, so it cannot pass a new static prop to an existing child.

There are two ways to pass dynamic data:

1. **Pass a getter** and read it in a tracking context in the child:

```js
function Greeting(props) {
  // props.name is a getter because the parent passed name=${name}
  return html`<p>Hello, ${() => props.name()}!</p>`;
}

function App() {
  const [name] = createAtom("Alice");
  return html`<${Greeting} name=${name} />`;
}
```

2. **Use a store or context** when many descendants need shared state. See [Components](./components.md#stores).

If you pass a plain value, it stays static:

```js
html`<${Greeting} name="Alice" />`;
// props.name() would throw; props.name is the string "Alice"
```

Because children do not re-render, replacing a static prop requires creating a new child. Use a conditional (`showIf`) or a keyed list (`forEach`) so the old instance is removed and a new one is mounted.

Use function declarations or function expressions for views that need `this`:

```js
function Panel() {
  onMount(this, () => {
    /* ... */
  });
  return html`<div>Panel</div>`;
}
```

An arrow function has no own `this` binding, so hooks that take the context will not work.

## Lists and conditionals

Use `showIf`, `hideIf`, `showUnless`, `hideUnless`, `branch`, and `forEach` from [Components](./components.md#control-flow-helpers). `forEach` receives item and index **getters**, so read them inside a getter:

```js
html`<ul>
  ${forEach(
    items,
    (item) => item.id,
    (item) => html` <li>${() => item().name}</li> `,
  )}
</ul>`;
```

## JSX

Enable the automatic JSX runtime:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@manyducks.co/dolla"
  }
}
```

Then use JSX as usual:

```jsx
function Greeting({ name }) {
  return <p>Hello, {name}!</p>;
}
```

Important differences from React:

- Props are still captured at mount; pass getters for reactive props.
- There is no re-render, so there is no need for `useCallback`/`useMemo` for referential stability.
- Use the hooks from [Hooks](./hooks.md), not React hooks.

See [JSX setup](./jsx.md) for the minimal configuration.

## Common mistakes

| Symptom                       | Cause                                                    | Fix                                                  |
| ----------------------------- | -------------------------------------------------------- | ---------------------------------------------------- |
| Value never updates           | `${count()}`                                             | `${count}` or `${() => count()}`                     |
| List item text never updates  | `${item.name}` or `${item().name}`                       | `${() => item().name}`                               |
| Prop getter throws            | Parent passed a static value, child calls `props.name()` | Pass `name=${getter}` or use `props.name` as a value |
| `this` is undefined in a view | View is an arrow function                                | Use `function View() {}`                             |
| Route params never update     | `${router.params().id}`                                  | `${() => router.params().id}`                        |
| App renders nothing           | `mount` not awaited or selector missing                  | `await createRoot("#app").mount(App)`                |
