# HTML templates without a compiler

Dolla's `html` helper is a tagged template that produces the same `Markup` objects as JSX. It needs no compiler, so it works directly in the browser and in any bundler that can resolve npm imports. It is the buildless path.

JSX is the default in these docs because it has editor tooling and type-checking. This page is the complete reference for the `html` alternative, including a JSX equivalent for every construct.

```js
import { html } from "@manyducks.co/dolla";
```

> You still need a bundler or dev server to resolve `@manyducks.co/dolla`. "Buildless" means no JSX transform or template compiler, not no tooling at all.

## Basic syntax

```js
const name = "Alice";

const view = html`
  <section class="card">
    <h1>Hello, ${name}!</h1>
    <p>This is a Dolla template.</p>
  </section>
`;
```

The template returns a `Markup` object (or an array of them for multiple roots). You can return it from a view, nest it, or pass it to `createRoot(...).mount(...)`.

### Attributes

Static attributes use normal HTML syntax:

```js
html`<input type="email" placeholder="you@example.com" />`;
```

Dynamic attributes use `${...}`:

```js
html`<input value=${getEmail} onInput=${(event) => setEmail(event.target.value)} />`;
```

Pass a getter (`getEmail`) to keep the attribute reactive. Pass the result (`getEmail()`) only when you want a static value.

### Boolean attributes

A bare attribute is `true`:

```js
html`<button disabled>Save</button>`;
html`<button disabled=${getIsSaving}>Save</button>`;
```

### Text and whitespace

Text is rendered as a text node. The parser trims leading and trailing whitespace around newlines, so use explicit spaces or CSS when spacing matters:

```js
html`<p>Hello, ${getFirstName} ${getLastName}!</p>`;
```

## Reactivity

The getter rule is the same as in JSX:

```js
const [getCount, setCount] = createAtom(0);

html`<p>Count: ${getCount}</p>`;   // reactive: the getter is tracked
html`<p>Count: ${getCount()}</p>`; // static: the value is baked in
```

For a derived value, use `compose` or an inline getter:

```js
const getDoubled = compose(() => getCount() * 2);

html`<p>${getDoubled}</p>`;
html`<p>${() => getCount() * 2}</p>`;
```

For a property access on a list item, wrap it in a getter:

```js
html`<li>${() => getItem().text}</li>`;
```

## Components

Components are interpolated in the tag position.

Self-closing:

```js
html`<${Greeting} name="Alice" />`;
```

With children:

```js
html`<${Card}><p>Hello</p></>`;
```

`</>` is the standard closing tag. `</${Card}>` also works, and `<//>` is a legacy shorthand. New code should use `</>`.

Props are passed like attributes:

```js
html`<${Greeting} name=${getUserName} />`;
```

Static values are captured once. Getter values stay reactive.

Children are available as `props.children`:

```js
function Card(props) {
  return html`<section class="card">${props.children}</section>`;
}

html`<${Card}><p>Hello</p></>`;
```

## Events

Use `onClick`, `onInput`, and so on. Event names are case-insensitive, so lowercase `onclick` also works.

```js
html`<button onClick=${() => setCount((count) => count + 1)}>+1</button>`;
```

The value may also be an object with `handleEvent` and listener options:

```js
html`<button onClick=${{ handleEvent: onClick, once: true }}>Once</button>`;
```

## Classes

`class` and `className` accept:

- a string;
- an object of class names to booleans;
- an array containing strings, objects, or CSS templates;
- one or more `css` templates.

```js
html`<div class="card"></div>`;
html`<div class=${["card", { active: getIsActive }]}></div>`;
html`<div class=${cardTemplate}></div>`;
```

Object values can be getters, so `{ active: getIsActive }` toggles the class reactively.

## Styles

`style` accepts a string, an object, or an array of either:

```js
html`<div style=${{ color: "red", padding: 8 }}></div>`;
html`<div style="color: red; padding: 8px"></div>`;
```

Numeric values get a `px` suffix unless the property is unitless (for example `opacity`, `z-index`, `line-height`). Object values can be getters. CSS templates are not supported on `style`; pass them to `class`.

## Refs

Pass `createRef()` or a callback to `ref`:

```js
const inputRef = createRef();

html`<input ref=${inputRef} />`;
```

```js
html`<input
  ref=${(element) => {
    element.focus();
    return () => element.blur();
  }}
/>`;
```

## SVG

SVG elements created through an `<svg>` tag use the SVG namespace. Nested `foreignObject` content switches back to HTML. SVG presentation attributes written in camelCase (`fillOpacity`, `strokeWidth`) are converted to kebab-case.

```js
html`
  <svg viewBox="0 0 24 24" width="24" height="24">
    <circle cx="12" cy="12" r="10" fillOpacity="0.5"></circle>
  </svg>
`;
```

## Comments

HTML comments are ignored:

```js
html`
  <div>
    <!-- This is not rendered. -->
    <p>Hello</p>
  </div>
`;
```

## Multiple roots

A template can contain more than one top-level node. The framework wraps them in a fragment.

```js
function Layout() {
  return html`
    <header>Header</header>
    <main>Content</main>
  `;
}
```

A view can also return an array of templates:

```js
function Layout() {
  return [html`<header>Header</header>`, html`<main>Content</main>`];
}
```

## Spread props

Use `...${...}` to spread an object into props:

```js
const buttonProps = { type: "submit", class: "primary" };

html`<button ...${buttonProps}>Save</button>`;
```

## Property and attribute escape hatches

Dolla chooses how to apply each prop:

- If the key exists on the DOM element and is not an SVG element, it is set as a property.
- Boolean properties also set or remove the attribute.
- Everything else is set as an attribute.
- Keys starting with `prop:` are always set as properties.
- Keys starting with `attr:` or `:` are always set as attributes (lowercased).
- `for` is assigned to `htmlFor`.

```js
html`<input prop:value=${getText} />`;
html`<div attr:data-id=${getId}></div>`;
html`<div :data-id=${getId}></div>`;
```

## Control flow

The control-flow helpers are syntax-agnostic. They return renderables, so you interpolate them directly.

### Conditionals

```js
html`${showIf(getIsLoggedIn, html`<p>Welcome!</p>`)}`;
html`${showIf(getIsLoading, html`<p>Loading...</p>`, html`<p>Ready</p>`)}`;
html`${hideIf(getIsLoading, html`<p>Content</p>`, html`<p>Loading...</p>`)}`;
```

### Branching

```js
html`${branch(getStatus, {
  loading: html`<p>Loading...</p>`,
  ready: html`<${Profile} />`,
  error: html`<p>Something went wrong.</p>`,
}, html`<p>Unknown status</p>`)}`;
```

### Lists

```js
html`
  <ul>
    ${forEach(
      getItems,
      (item) => item.id,
      (getItem, getIndex) => html`
        <li>${getIndex}: ${() => getItem().text}</li>
      `,
    )}
  </ul>
`;
```

### Keep-alive

```js
html`${showIf(getActiveTab, keepAlive(html`<${Editor} />`))}`;
```

## JSX ↔ `html` equivalents

| Construct | JSX | `html` |
|---|---|---|
| Element | `<div class="card">Hi</div>` | `` html`<div class="card">Hi</div>` `` |
| Expression | `<p>{getCount}</p>` | `` html`<p>${getCount}</p>` `` |
| Static expression | `<p>{getCount()}</p>` | `` html`<p>${getCount()}</p>` `` |
| Component | `<Greeting name="Alice" />` | `` html`<${Greeting} name="Alice" />` `` |
| Component with children | `<Card><p>Hello</p></Card>` | `` html`<${Card}><p>Hello</p></>` `` |
| Reactive prop | `<Greeting name={getUserName} />` | `` html`<${Greeting} name=${getUserName} />` `` |
| Children | `<section>{props.children}</section>` | `` html`<section>${props.children}</section>` `` |
| Event | `<button onClick={increment}>+</button>` | `` html`<button onClick=${increment}>+</button>` `` |
| Class | `<div class={["card", { active: getActive }]}>` | `` html`<div class=${["card", { active: getActive }]}>` `` |
| Style | `<div style={{ color: "red" }}>` | `` html`<div style=${{ color: "red" }}>` `` |
| Ref | `<input ref={inputRef} />` | `` html`<input ref=${inputRef} />` `` |
| Fragment | `<><Header /><Main /></>` | `` html`<${Header} /><${Main} />` `` |
| Conditional | `{showIf(getOpen, <p>Open</p>)}` | `` html`${showIf(getOpen, html`<p>Open</p>`)}` `` |
| List | `{forEach(getItems, keyFn, renderFn)}` | `` html`${forEach(getItems, keyFn, renderFn)}` `` |
| Spread props | `<button {...buttonProps}>` | `` html`<button ...${buttonProps}>` `` |
| Boolean attribute | `<button disabled>` | `` html`<button disabled>` `` |
| Comment | `{/* ignored */}` | `` html`<!-- ignored -->` `` |
| Dynamic component | `const Tag = MyComponent; <Tag />` | `` html`<${Tag} />` `` |
| Multiple roots | `return [<a />, <b />]` | `` return html`<a></a><b></b>` `` |

## Limitations

- **No editor type-checking.** Tagged templates are strings to TypeScript. JSX gives you prop checking and autocomplete; `html` does not.
- **No prop types for components.** A component's props are not checked at the call site.
- **Component closing tags use `</>`.** Write `<${Card}>...</>`, not `</Card>`. The older `<//>` shorthand is supported but not recommended.
- **No `key` prop.** Use the key function passed to `forEach`.
- **No JSX fragments.** Multiple roots are already supported; return an array or a template with multiple top-level nodes.
- **Tooling.** Syntax highlighting and formatting inside tagged templates depend on your editor. JSX has broader support.

Use `html` when you want a no-compiler setup, a quick prototype, or a buildless demo. Use JSX when you want type-checking and editor support.

## Migrating from JSX

| JSX | `html` |
|---|---|
| `className` / `htmlFor` | `class` / `for` (both forms work) |
| `{expression}` | `${expression}` |
| `<Component />` | `<${Component} />` |
| `<Component>...</Component>` | `<${Component}>...</>` |
| `<>{children}</>` | Return an array, or put the children in one template |
| `{/* comment */}` | `<!-- comment -->` |
| `<div {...props} />` | `` html`<div ...${props}></div>` `` |

## Common mistakes

| Symptom | Cause | Fix |
|---|---|---|
| Value never updates | `${getCount()}` | `${getCount}` or `${() => getCount()}` |
| List item text never updates | `${getItem().text}` | `${() => getItem().text}` |
| Component renders nothing | Missing `<${}` around the component | `<${Card} />`, not `<Card />` |
| Closing tag error | Using `</Card>` | Use `</>` |
| Prop getter throws | Parent passed a static value, child calls `props.name()` | Pass `name=${getUserName}` or use `unwrap(props.name)` |
| `this` is undefined | Arrow function used with `this` | Use `(props, context)` or a function declaration |

## Complete example

The same counter in both styles.

### JSX

```jsx
import { createAtom, createRoot, onEffect } from "@manyducks.co/dolla";

function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);

  onEffect(context, () => {
    console.log("count:", getCount());
  });

  return (
    <div>
      <p>Count: {getCount}</p>
      <button onClick={() => setCount((count) => count + 1)}>+1</button>
      <button onClick={() => setCount((count) => count - 1)}>-1</button>
    </div>
  );
}

await createRoot("#app").mount(Counter);
```

### `html`

```js
import { createAtom, createRoot, html, onEffect } from "@manyducks.co/dolla";

function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);

  onEffect(context, () => {
    console.log("count:", getCount());
  });

  return html`
    <div>
      <p>Count: ${getCount}</p>
      <button onClick=${() => setCount((count) => count + 1)}>+1</button>
      <button onClick=${() => setCount((count) => count - 1)}>-1</button>
    </div>
  `;
}

await createRoot("#app").mount(Counter);
```

## Next steps

- [Templates](./templates.md) — the JSX template reference and shared rules
- [Mental model](./concepts.md) — why views run once
- [Reactivity](./reactivity.md) — atoms, `compose`, effects, batching
- [Components](./components.md) — views, stores, and control flow
