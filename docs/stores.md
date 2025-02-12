# Stores

> TODO: Write about stores

```tsx
import Dolla, { createState } from "@manyducks.co/dolla";

function CounterStore (initialValue, ctx) {
  const [$count, setCount] = createState(initialValue);

  // Respond to context events which bubble up from views.
  this.on("counter:increment", () => {
    setCount((count) => count + 1);
  });

  this.on("counter:decrement", () => {
    setCount((count) => count - 1);
  });

  this.on("counter:reset", () => {
    setCount(0);
  });

  return $count;
});

// Stores can be attached to the app itself.
Dolla.attachStore(CounterStore, 0);

function CounterView(props, ctx) {
  // Store instances can also be attached at the view level to provide them to the current scope and those of child views.
  // Views that are not children of this CounterView will not be able to access this particular instance of CounterStore.
  this.attachStore(CounterStore, 0);

  // Store return values can be accessed with `useStore`.
  // This method will traverse up the view tree to find the nearest attached instance.
  // An error will be thrown if no instances are attached at or above this level in the tree.
  const $count = this.useStore(CounterStore);

  // The buttons increment the value inside the store by emitting events.
  // Child views at any depth could also emit these events to update the store.
  return (
    <div>
      <p>Clicks: {$count}</p>
      <div>
        <button onClick={() => this.emit("counter:decrement")}>-1</button>
        <button onClick={() => this.emit("counter:reset")}>Reset</button>
        <button onClick={() => this.emit("counter:increment")}>+1</button>
      </div>
    </div>
  );
});
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
