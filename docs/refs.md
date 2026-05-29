# Refs

Access DOM nodes directly using `createRef`.

```jsx
import { createRef, onMount } from "@manyducks.co/dolla";

function AutoFocus() {
  const inputRef = createRef();

  onMount(this, () => {
    inputRef().focus();
  });

  return html`<input ref=${inputRef} />`;
}
```

## How it works

`createRef()` returns a callable `Ref<T>` object:

- **Getter**: `ref()` — returns the current value (or `undefined` if not yet set).
- **Setter**: `ref(value)` — sets the value and returns a cleanup function that clears the ref.

The `ref` attribute on an element calls the setter with the DOM node when the element mounts. The cleanup function runs when the element unmounts.

```jsx
const elRef = createRef();
html`<div ref=${elRef}>...</div>`;
elRef(); // the <div> element
```
