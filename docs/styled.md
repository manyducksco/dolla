# Styled components

`styled` builds components from CSS templates. It is an optional submodule: import it from `@manyducks.co/dolla/styled`, and it is left out of your bundle entirely when unused.

`styled` is a thin layer over the [`css`](./css.md) helper. It generates the class, attaches the reactive bindings, and renders either an intrinsic element or an existing View with the class merged in.

Every styled element uses the same `css-<hash>` class format as `css`. Identical styles share one class and one stylesheet rule, whether they come from `styled` or `css`.

Examples use `class` in JSX; `className` also works.

## Usage

```jsx
import { styled } from "@manyducks.co/dolla/styled";

const Button = styled.button`
  padding: 8px 12px;
  border-radius: 6px;
  color: ${getColor};
`;

<Button onClick={onClick}>Click me</Button>;
```

Intrinsic tags, custom element names, and existing Views are supported:

```jsx
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

```jsx
const Panel = styled.section`
  padding: ${getPadding};
  border-color: ${{ syntax: "<color>", value: getBorderColor, initialValue: "transparent" }};
  background: ${getSurface};
`;
```

Styled components can also be interpolated as selectors:

```jsx
const Text = styled.span`
  color: red;
`;

const Label = styled.label`
  &:hover ${Text} {
    opacity: 1;
  }
`;
```

## Class merging

An existing `class` or `className` prop is preserved and combined with the generated class:

```jsx
<Button class="compact">Save</Button>
```

The rendered element has both the styled class and `compact`. Array and object class forms work as usual:

```jsx
const [getIsActive] = createAtom(false);

<Button class={["compact", { active: getIsActive }]}>Save</Button>;
```

Styled classes are placed before caller-supplied classes, so caller templates win when both set the same property.

## Props

Props are passed through to the underlying element or wrapped View:

```jsx
const Input = styled.input`
  border: 1px solid #ccc;
`;

<Input type="email" value={getEmail} />;
```

Event handlers, refs, `prop:`/`attr:` keys, and reactive props behave the same as on a normal element. See [Templates](./templates.md).

## View names

Use `.named(name)` to give a styled component a readable View name:

```jsx
const PrimaryButton = styled.button.named("PrimaryButton")`
  background: blue;
`;
```

The component's View name becomes `Styled(PrimaryButton)`. With debug mode enabled, the framework's existing `data-view` attribute shows that name on rendered elements:

```jsx
await createRoot("#app", { debug: true }).mount(App);
```

```jsx
<button class="css-1a2b3c" data-view="Styled(PrimaryButton)"></button>
```

The class name is unchanged. Names are only debug metadata, so differently named components with identical styles still share one `css-<hash>` class and rule.

When the Vite plugin is active, top-level styled declarations are named automatically in development:

```jsx
// The dev View name becomes Styled(PrimaryButton)
const PrimaryButton = styled.button`
  background: blue;
`;
```

Producing the same View name in a production build requires calling `.named` explicitly.

## Changing the tag

`.as(tag)` changes the rendered tag for every instance:

```jsx
const Button = styled.button.as("a")`
  text-decoration: none;
`;

<Button href="/account">Account</Button>;
```

The per-instance `as` prop wins over the bound tag:

```jsx
<Button as="button" type="submit">
  Save
</Button>
```

For an intrinsic base, `as` selects the tag locally and is not forwarded to the DOM. For a wrapped View, `as` is forwarded as a prop; the wrapped View must pass it to its root element if it wants to honor it.

## Wrapping Views

`styled(MyView)` wraps a component and merges the generated class into its rendered root:

```jsx
function Card(props) {
  return <article class={props.class}>{props.children}</article>;
}

const ElevatedCard = styled(Card)`
  box-shadow: 0 4px 16px rgb(0 0 0 / 0.15);
`;

<ElevatedCard>Content</ElevatedCard>;
```

The wrapped View should forward `class` and `as` to its root element. When the wrapped View is another styled component, those props are handled automatically.

## Tree shaking

`styled` is exported from its own submodule, `@manyducks.co/dolla/styled`. Importing it pulls in the `css` machinery it needs. Importing only the core package does not include `styled`, so apps that do not use it pay nothing for it.

## API

### ``styled.tag`...` ``

Creates a styled View from an intrinsic tag. `styled` is a proxy, so any tag name works, including `styled["my-element"]`.

### ``styled(View)`...` ``

Creates a styled View from an existing View.

### `.named(name)`

Returns a new styled builder whose View name is `Styled(name)`. The name appears in the `data-view` attribute when debug mode is enabled. It does not change class names or stylesheet deduplication.

### `.as(tag)`

Returns a new styled builder bound to a different rendered tag. The original builder is unchanged.

### Props

Styled Views accept the base tag/View props plus:

| Prop           | Description                                 |
| -------------- | ------------------------------------------- |
| `as`           | Override the rendered tag for this instance |
| `class`        | Merged with the generated class             |
| `className`    | Alias for `class`; merged the same way      |
| any other prop | Forwarded to the underlying element or View |

## Next steps

- [CSS](./css.md) — the `css` helper
- [Templates](./templates.md) — props, classes, and events
- [Cheatsheet](./cheatsheet.md) — quick lookups
