# CSS

Dolla includes a CSS-in-JS solution via the `css` tagged template literal. It generates scoped class names, registers styles in a shared `CSSStyleSheet`, and supports reactive variables.

```js
import { css } from "@manyducks.co/dolla";

const redText = css`
  color: red;
  font-weight: bold;
`;

console.log(redText.className); // "css-1a2b3c"
console.log(String(redText));   // "css-1a2b3c"
```

## Usage with views

Pass the class name as a string — it works naturally with the `class` attribute:

```jsx
const card = css`
  padding: 16px;
  border: 1px solid #ddd;
  border-radius: 8px;
`;

function Card() {
  return html`<div class="${card}">...</div>`;
}
```

## Deduplication

The same CSS input always produces the same class name. If multiple components use the same `css\`...\`` template, the styles are registered only once.

```js
const a = css`color: red;`;
const b = css`color: red;`;
console.log(a.className === b.className); // true
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

Pass a getter (e.g. an atom) for a reactive CSS variable. When the signal changes, the CSS custom property updates on the element without touching the stylesheet:

```js
const [color, setColor] = createAtom("blue");
const tpl = css`
  color: ${color};
`;
```

You can also specify a CSS syntax and initial value using an array `[getter, syntax, initialValue]`:

```js
const tpl = css`
  padding: ${[padding, "<length>", "0px"]};
`;
```

If the current value equals `initialValue`, the variable is stripped from the element (falling back to the default in the CSS rule).

## Template composition

Reference another `CSSTemplate` in an interpolation to compose selectors:

```js
const base = css`color: red;`;
const tpl = css`
  ${base} {
    font-weight: bold;
  }
`;
```

This generates a rule like `.css-abc .css-def { font-weight: bold; }`.

## Child templates

Use `.with()` to compose child templates that are attached to the same element:

```js
const base = css`color: red;`;
const child = css`font-weight: bold;`;
const combined = base.with(child);
```

`.with()` returns a new template — the original is not mutated:

```js
const a = css`color: red;`;
const b = a.with(child1);
const c = b.with(child2);
// a.children === []
// b.children === [child1]
// c.children === [child1, child2]
```

Child templates are attached to the element when the parent is attached.

## Conditional attachment

Attach a template only when a condition is met:

```js
const combined = base.with(child, isLoggedIn);
```

Pass a getter for reactive conditions:

```js
const combined = base.with(child, () => isLoggedIn());
```

## API

### `css\`...\``

Returns a `CSSTemplate` object:

| Property/Method | Description |
|---|---|
| `className` | The generated scoped class name |
| `children` | Array of child `[CSSTemplate, condition]` tuples |
| `toString()` | Returns `className` |
| `attach(context, element, condition?)` | Applies the class to an element — called internally by the framework |
| `with(template, condition?)` | Returns a new CSSTemplate with the child appended |
