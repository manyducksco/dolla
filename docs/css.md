# CSS

Dolla does not require CSS-in-JS. You can style with CSS modules, a plain stylesheet, or a plain class string. The `css` tagged template is an optional convenience: it generates scoped class names, registers styles in a shared `CSSStyleSheet`, and supports reactive variable bindings.

Examples use `class` in JSX; `className` also works. See [Templates](./templates.md#classes).

## Plain CSS and CSS modules

A classic stylesheet works exactly as you would expect:

```css
.card {
  padding: 16px;
  border: 1px solid #ddd;
}
```

```jsx
<div class="card">...</div>;
```

If your bundler supports CSS modules, pass the imported class name through:

```jsx
import styles from "./card.module.css";

<div class={styles.card}>...</div>;
```

The `class` prop accepts plain strings, class maps, arrays, and `css` templates. Use whichever fits your project; the rest of this page covers the optional `css` helper.

```js
import { css } from "@manyducks.co/dolla";

const redText = css`
  color: red;
  font-weight: bold;
`;

redText.className; // "css-1a2b3c"
String(redText); // "css-1a2b3c"
```

## Usage with views

Pass a template to `class`:

```jsx
import { createRoot, css } from "@manyducks.co/dolla";

const card = css`
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
`;

function Card() {
  return <div class={card}>...</div>;
}

await createRoot("#app").mount(Card);
```

`class` accepts a string, a `CSSTemplate`, a conditional template, or an array containing any of those:

```jsx
const [getCount] = createAtom(0);
const getIsActive = () => getCount() > 0;
const highlight = css`
  outline: 2px solid gold;
`;

<div class={[card, highlight.when(getIsActive)]}>...</div>;
```

## Deduplication

The same CSS input always produces the same class name. If multiple components use the same `css` template, the styles are registered only once.

```js
const a = css`
  color: red;
`;
const b = css`
  color: red;
`;

a.className === b.className; // true
```

## Interpolation

Static values are baked into the stylesheet at registration time:

```js
const size = "20px";
const tpl = css`
  font-size: ${size};
`;
```

## Reactive variables

Pass a getter to bind a CSS custom property. When the signal changes, the property updates on the element without rebuilding the stylesheet. This is the same getter rule described in [Values flow through getters](./concepts.md#values-flow-through-getters):

```js
const [getColor, setColor] = createAtom("blue");

const tpl = css`
  color: ${getColor};
`;
```

Use a `PropertyConfig` object when you need a typed `@property` registration, an initial value, or inheritance:

```js
const [getPadding, setPadding] = createAtom("0px");

const tpl = css`
  padding: ${{ syntax: "<length>", value: getPadding, initialValue: "0px", inherits: false }};
`;
```

The `value` may be a getter or a static value. When the value is `null`, `undefined`, or equal to `initialValue`, the custom property is removed so the CSS fallback applies.

## Template composition

Reference another `CSSTemplate` in a selector interpolation to compose rules:

```js
const base = css`
  color: red;
`;

const tpl = css`
  ${base} {
    font-weight: bold;
  }
`;
```

This generates a rule like `.css-abc .css-def { font-weight: bold; }`.

To apply multiple templates to the same element, pass them in a class array:

```jsx
<div class={[base, child]}>...</div>;
```

## Conditional templates

Call `.when(condition)` to return a conditional template:

```jsx
const card = css`
  padding: 16px;
`;
const [getIsActive] = createAtom(false);

<div class={card.when(getIsActive)}>...</div>;
```

`getIsActive` is a getter, so the class is attached and detached as it changes. A plain boolean also works, but is evaluated once. See [Values flow through getters](./concepts.md#values-flow-through-getters).

## Styling a component

Use a `css` template as the component's class. Merge a caller-supplied `class` when needed:

```jsx
const button = css`
  padding: 8px 12px;
`;

function Button(props) {
  return <button class={[button, props.class]}>{props.children}</button>;
}
```

Class names always use the `css-` prefix and a hash of the template contents. Identical templates share the same class and stylesheet rule.

## API

### ``css`...` ``

Returns a `CSSTemplate`:

| Member | Description |
| --- | --- |
| `className` | The generated scoped class name |
| `when(condition)` | Returns a conditional template that is attached only when the condition is truthy |
| `attach(context, element, condition?)` | Applies the class and reactive bindings to an element. Called internally by the framework. |
| `toString()` | Returns `className` |

## Next steps

- [Templates](./templates.md#classes) — the `class` prop
- [Cheatsheet](./cheatsheet.md) — quick lookups
