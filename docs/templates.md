# Templates

Dolla has two template styles that produce the same markup: **JSX** and the **`html` tagged template**. JSX is the default in these docs because it has editor tooling and type-checking. This page covers JSX and the rules that apply to both styles. For the complete buildless syntax, see [HTML templates](./html.md).

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Choosing a style

- **JSX** needs a compiler, but gives you syntax highlighting, autocomplete, and prop type-checking. This is the recommended default.
- **`html`** needs no compiler and works directly in the browser. It is the buildless option.

Both styles return the same `Markup` objects, so components written in one style can render components written in the other.

## Interpolation

The most important rule: pass a **getter**, not a value, when you want the DOM to update.

```jsx
const [getCount, setCount] = createAtom(0);

<p>{getCount}</p>;   // reactive: the getter is tracked
<p>{getCount()}</p>; // static: the current value is baked in
```

If you need to transform the value, wrap the work in a getter or use `compose`:

```jsx
<p>{() => getCount() * 2}</p>;
<p>{compose(() => getCount() * 2)}</p>;
```

## What can be rendered

These values can be interpolated or returned from a view:

| Value | Behavior |
| --- | --- |
| `string`, `number` | Rendered as a text node |
| `Markup` | Rendered as elements/components |
| `MarkupNode` | Mounted directly |
| `Node` | Inserted into the DOM |
| Getter (`() => value`) | Tracked and rendered reactively |
| Array | Each item is processed, in order |
| `null`, `undefined`, `false` | Rendered as nothing |

A view can return multiple root nodes, either as an array or as a fragment:

```jsx
function Layout() {
  return (
    <>
      <header>Header</header>
      <main>Content</main>
    </>
  );
}
```

```jsx
function Layout() {
  return [<header>Header</header>, <main>Content</main>];
}
```

## Elements

### Text and attributes

```jsx
const [getName] = createAtom("Alice");

<p class="greeting" title={getName}>Hello, {() => getName()}!</p>;
```

Attribute values are reactive when you pass a getter. The framework decides how to apply each key:

- If the key exists on the DOM element and is not an SVG element, it is set as a property.
- Boolean properties also set or remove the attribute.
- Everything else is set as an attribute.
- Keys starting with `prop:` are always set as properties.
- Keys starting with `attr:` are always set as attributes (lowercased). In `html` templates, a leading `:` is shorthand for `attr:`.
- `for` is assigned to `htmlFor`.

```jsx
<input prop:value={getText} />;
<div attr:data-id={getId}></div>;
```

`class` and `for` are the defaults in these examples. `className` and `htmlFor` also work.

### Classes

`class` and `className` accept a string, an object of class names to booleans, an array of either, or one or more CSS templates:

```jsx
const [getIsActive] = createAtom(false);

<div class="card"></div>;
<div class={["card", { active: getIsActive }]}></div>;
<div class={cardTemplate}></div>;
```

Object values can be getters when the class should toggle reactively. See [CSS](./css.md) for `css` templates, reactive variables, and `styled` components.

### Styles

`style` accepts a string, a style object, or an array of either:

```jsx
<div style={{ color: "red", padding: 8 }}></div>;
<div style="color: red; padding: 8px"></div>;
```

Numeric values get a `px` suffix unless the property is unitless (for example `opacity`, `z-index`, `line-height`). Object values can be getters. CSS templates are not supported on `style`; pass them to `class` instead.

### Events

Use `onClick`, `onInput`, and so on. Event names are case-insensitive, so lowercase `onclick` also works:

```jsx
<button onClick={() => setCount((count) => count + 1)}>+1</button>;
```

The value may also be an object with `handleEvent` and listener options:

```jsx
<button onClick={{ handleEvent: onClick, once: true }}>Once</button>;
```

### Refs

Pass `createRef()` or a callback to `ref`:

```jsx
const inputRef = createRef();

<input ref={inputRef} />;
```

```jsx
<input
  ref={(element) => {
    element.focus();
    return () => element.blur();
  }}
/>;
```

See [Refs](./refs.md).

### SVG

SVG elements created through an `<svg>` tag use the SVG namespace. Nested `foreignObject` content switches back to HTML. SVG presentation attributes written in camelCase (`fillOpacity`, `strokeWidth`) are converted to kebab-case.

```jsx
<svg viewBox="0 0 24 24" width="24" height="24">
  <circle cx="12" cy="12" r="10" fillOpacity="0.5" />
</svg>;
```

## Components

Components are used like elements. Self-closing components use `/>`:

```jsx
<Greeting name="Alice" />;
```

Children go between the tags:

```jsx
<Card>
  <p>Hello</p>
</Card>;
```

Inside `Card`, the children are available as `props.children`:

```jsx
function Card(props) {
  return <section class="card">{props.children}</section>;
}
```

### Multiple roots

A view may return multiple root nodes, either as a fragment or as an array. See [What can be rendered](#what-can-be-rendered).

## Props and the run-once model

This is the biggest difference from React-style frameworks.

A view runs **once** when it mounts. Its `props` object is captured at that moment. If the parent's state changes, the parent does not re-run, so it cannot pass a new static prop to an existing child.

There are two ways to pass dynamic data:

1. **Pass a getter** and read it in a tracking context in the child:

```jsx
function Greeting(props) {
  // props.name is a getter because the parent passed name={getUserName}.
  return <p>Hello, {props.name}!</p>;
}

function App() {
  const [getUserName] = createAtom("Alice");
  return <Greeting name={getUserName} />;
}
```

When you need the value in logic, use `unwrap(props.name)`:

```jsx
function Greeting(props) {
  const getInitial = compose(() => unwrap(props.name).charAt(0));
  return <p>{getInitial}: {props.name}</p>;
}
```

2. **Use a store or context** when many descendants need shared state. See [Components](./components.md#stores).

If you pass a plain value, it stays static:

```jsx
<Greeting name="Alice" />;
// props.name() would throw; props.name is the string "Alice"
```

Because children do not re-render, replacing a static prop requires creating a new child. Use a conditional (`showIf`) or a keyed list (`repeat`) so the old instance is removed and a new one is mounted.

### TypeScript props

Type props explicitly. A static prop uses its plain type; a reactive prop is typed as `Getter<T>` and receives a getter:

```tsx
import type { Getter } from "@manyducks.co/dolla";

type GreetingProps = {
  name: Getter<string>;
  onSave: () => void;
};

function Greeting(props: GreetingProps) {
  return <p>Hello, {props.name}!</p>;
}

<Greeting name={getUserName} onSave={save} />;
```

If a prop accepts either a plain value or a getter, type it as `MaybeGetter<T>` and use `unwrap()` when you need the value in logic.

Use the context argument for lifecycle hooks and context data:

```jsx
function Panel(props, context) {
  onMount(context, () => {
    // ...
  });

  return <div>Panel</div>;
}
```

`this` is the same context object, so `function Panel() { onMount(this, ...) }` also works. The explicit argument is easier to follow and works with arrow functions.

## Lists and conditionals

Use `showIf`, `hideIf`, `branch`, and `repeat` from [Components](./components.md#control-flow-helpers). `repeat` receives item and index **getters**, so read them inside a getter:

```jsx
<ul>
  {repeat(
    getItems,
    (item) => item.id,
    (getItem, getIndex) => (
      <li>
        {getIndex}: {() => getItem().text}
      </li>
    ),
  )}
</ul>
```

## Using the `html` helper

The buildless equivalent of a component with children is:

```js
html`<${Card} title="Hello">Content</>`;
```

See [HTML templates](./html.md) for the full syntax, the JSX ↔ `html` equivalence table, and migration notes.

## Common mistakes

| Symptom | Cause | Fix |
| --- | --- | --- |
| Value never updates | `{getCount()}` | `{getCount}` or `{() => getCount()}` |
| List item text never updates | `{getItem().text}` | `{() => getItem().text}` |
| Prop getter throws | Parent passed a static value, child calls `props.name()` | Pass `name={getUserName}` or use `unwrap(props.name)` |
| `this` is undefined in a view | View is an arrow function | Use `(props, context)` or `function View() {}` |
| Route params never update | `{router.params().id}` | `{() => router.params().id}` |
| App renders nothing | `mount` not awaited or selector missing | `await createRoot("#app").mount(App)` |
| JSX doesn't compile | Missing `jsx` / `jsxImportSource` | See [Getting started](./getting-started.md) |
