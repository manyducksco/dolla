# Styled components

`styled` builds components from CSS templates. It is a thin layer over the `css` helper: it generates the class, attaches the reactive bindings, and renders either an intrinsic element or an existing View with the class merged in.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

```js
import { styled, html } from "@manyducks.co/dolla";

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 6px;
  color: ${color};
`;

html`<${Button} onClick=${onClick}>Click me<//>`;
```

Intrinsic tags, custom element names, and existing Views are supported:

```js
const FancyButton = styled(Button)`
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.2);
`;

const FancyDiv = styled["my-custom-element"]`
  display: block;
`;
```

## Interpolations

The template accepts the same interpolations as `css`:

- static strings and numbers,
- getters for reactive values,
- `CSSTemplate`s,
- `PropertyConfig` objects,
- other styled components.

```js
const Panel = styled.section`
  padding: ${padding};
  border-color: ${{ syntax: "<color>", value: borderColor, initialValue: "transparent" }};
  background: ${surface};
`;
```

## Class merging

An existing `class` prop is preserved and combined with the generated class:

```js
html`<${Button} class="compact" />`;
```

The rendered element has both the styled class and `compact`. Array and object class forms work as usual:

```js
const [active] = createAtom(false);

html`<${Button} class=${["compact", { active }]} />`;
```

## Props

Props are passed through to the underlying element or wrapped View:

```js
const Input = styled.input`
  border: 1px solid #ccc;
`;

html`<${Input} type="email" value=${email} />`;
```

Event handlers, refs, `prop:`/`attr:` keys, and reactive props behave the same as on a normal element. See [Templates](./templates.md).

## Naming

Use `.named(name)` to control the class prefix:

```js
const PrimaryButton = styled.button.named("PrimaryButton")`
  background: blue;
`;
```

The hash part is unchanged, so identical templates still deduplicate in the stylesheet. `css.named(name)` is also available if you want a custom prefix on a plain template.

## Changing the tag

`.as(tag)` changes the rendered tag for every instance:

```js
const Button = styled.button.as("a")`
  text-decoration: none;
`;

html`<${Button} href="/account">Account<//>`;
```

The per-instance `as` prop wins over the bound tag:

```js
html`<${Button} as="button" type="submit">Save<//>`;
```

For an intrinsic base, `as` selects the tag locally and is not forwarded to the DOM. For a wrapped View, `as` is forwarded as a prop; the wrapped View must pass it to its root element if it wants to honor it.

## Wrapping Views

`styled(MyView)` wraps a component and merges the generated class into its rendered root:

```js
function Card(props) {
  return html`<article class=${props.class}>${props.children}</article>`;
}

const ElevatedCard = styled(Card)`
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
`;

html`<${ElevatedCard}>Content<//>`;
```

The wrapped View should forward `class` (and optionally `as`) to its root element.

## API

### `styled.tag\`...\``

Creates a styled View from an intrinsic tag. `styled` is a proxy, so any tag name works, including `styled["my-element"]`.

### `styled(View)\`...\``

Creates a styled View from an existing View.

### `.named(name)`

Returns a new styled builder with a custom class prefix. The original builder is unchanged.

### `.as(tag)`

Returns a new styled builder bound to a different rendered tag. The original builder is unchanged.

### Props

Styled Views accept the base tag/View props plus:

| Prop | Description |
|---|---|
| `as` | Override the rendered tag for this instance |
| `class` | Merged with the generated class |
| any other prop | Forwarded to the underlying element or View |

## Notes

- `styled` uses the same deduplication and reactive-variable machinery as [`css`](./css.md).
- `preinsert()` and the shared stylesheet are implementation details; use `css`/`styled` instead.
- `css` templates are not supported on `style`; use `class`.
