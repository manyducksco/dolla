# Refs

Access DOM nodes directly using `createRef`.

```jsx
import { createRef, onMount } from "@manyducks.co/dolla";

function AutoFocus(props, context) {
  const inputRef = createRef();

  onMount(context, () => {
    inputRef().focus();
  });

  return <input ref={inputRef} />;
}
```

## How it works

`createRef()` returns a callable `Ref<T>` object:

- **Getter**: `ref()` — returns the current value (or `undefined` if not yet set).
- **Setter**: `ref(value)` — sets the value and returns a cleanup function that clears the ref.

The `ref` attribute on an element calls the setter with the DOM node when the element mounts. The cleanup function runs when the element unmounts.

```jsx
const elementRef = createRef();

<div ref={elementRef}>...</div>;

elementRef(); // the <div> element
```

`onMount` is the usual place to read a ref, because the DOM exists by then. If you read a ref during the view body, it is still `undefined`.

## Callback refs

Pass a function to run setup when the element mounts and return a cleanup function:

```jsx
<input
  ref={(element) => {
    element.focus();
    return () => element.blur();
  }}
/>;
```

Callback refs are useful when you need imperative setup that is not a single stored node.

## Next steps

- [Templates](./templates.md#refs) — the `ref` prop
- [Hooks](./hooks.md#lifecycle-hooks) — `onMount` and `onCleanup`
- [Cheatsheet](./cheatsheet.md) — quick lookups
