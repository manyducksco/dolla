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
<div class="card">...</div>
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

Each distinct static value produces its own class and stylesheet rule, and rules are never removed. That's fine for a handful of values such as variants or themes. For values that differ per instance or change over time, such as sizes, positions or colors from data, use a getter instead (see [Reactive variables](#reactive-variables)). A getter shares one class and sets the value as a CSS variable on each element:

```js
// One class per width: the stylesheet grows with every new value.
const staticBar = (width) => css`
  width: ${width}px;
`;

// One class in total: the width is set on each element.
const reactiveBar = (width) => css`
  width: ${() => `${width}px`};
`;
```

When one `css` call site has created 50 classes from different static values, Dolla logs a warning naming the template.

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
<div class={[base, child]}>...</div>
```

## Animations

A `@keyframes` block written inside a `css` template is registered as written, and its name is global. If two templates declare `@keyframes fade` with different steps, the one registered last is used by both. Give hand-written keyframes names that are unique across the app, or use `keyframes`.

`keyframes` registers the rule under a name generated from its contents and returns that name. Interpolate it wherever an animation name goes:

```js
import { css, keyframes } from "@manyducks.co/dolla";

const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

const panel = css`
  animation: ${fadeIn} 200ms ease-out;
`;
```

Two different `keyframes` never share a name, so they can't overwrite each other. Identical ones share a single rule. Static values can be interpolated. Getters can't, because keyframes are registered once rather than bound to an element. Animate a custom property set by a reactive variable instead.

The rule is registered when `keyframes` is called, so the name also works outside `css`, for example in an inline `style` or a Web Animations call.

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

If you want a component-shaped API instead of wiring the class yourself, use the optional [`styled`](./styled.md) submodule.

## API

### ``css`...` ``

Returns a `CSSTemplate`:

| Member                                 | Description                                                                                |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `className`                            | The generated scoped class name                                                            |
| `when(condition)`                      | Returns a conditional template that is attached only when the condition is truthy          |
| `attach(context, element, condition?)` | Applies the class and reactive bindings to an element. Called internally by the framework. |
| `toString()`                           | Returns `className`                                                                        |

### ``keyframes`...` ``

Registers a `@keyframes` rule and returns a `Keyframes` object:

| Member       | Description                                |
| ------------ | ------------------------------------------ |
| `name`       | The generated animation name (`kf-<hash>`) |
| `toString()` | Returns `name`, so it can be interpolated  |

## Next steps

- [Styled components](./styled.md) — the optional `styled` submodule
- [Templates](./templates.md#classes) — the `class` prop
- [Cheatsheet](./cheatsheet.md) — quick lookups
