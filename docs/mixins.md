# Mixins

Mixins are a way to add custom lifecycle handlers to plain DOM nodes without creating an entire view. You can encapsulate reusable logic in mixin functions and apply them like CSS classes.

Mixin functions take a reference to the DOM node as their first argument.

```tsx
import { type Mixin, useContext, useMount, useUnmount } from "@manyducks.co/dolla";

const logMe: Mixin = (element) => {
  const context = useContext();

  useMount(() => {
    context.log("element mounted");
  });

  useUnmount(() => {
    context.log("element unmounted");
  });
};

// Pass one mixin
<h1 mixin={logMe}>Title</h1>;

// Or an array of mixins
<p mixin={[logMe, anotherMixin, yetAnotherMixin]}>Text goes here...</p>;
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
