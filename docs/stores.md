# Stores

> TODO: Write about stores

```tsx
import { createApp useSignal, mount } from "@manyducks.co/dolla";



function CounterStore (initialValue, ctx) {
  const [$count, setCount] = useSignal(initialValue);

  // Respond to context events which bubble up from views.
  ctx.on("counter:increment", (e) => {
    e.stop(); // call to stop events bubbling to parent contexts.
    setCount((count) => count + 1);
  });

  ctx.on("counter:decrement", () => {
    setCount((count) => count - 1);
  });

  ctx.on("counter:reset", () => {
    setCount(0);
  });

  return $count;
});


function CounterView(props, ctx) {
  // Store instances can also be provided at the view level to provide them to the current scope and those of child views.
  // Views that are not children of this CounterView will not be able to access this particular instance of CounterStore.
  ctx.provide(CounterStore, 0);

  // Store return values can be accessed with `use`.
  // This method will check the current context for an instance, then recursively check up the view tree until it finds one.
  // An error will be thrown if no instances of the store are provided.
  const $count = ctx.use(CounterStore);

  // The buttons increment the value inside the store by emitting events.
  // Child views at any depth could also emit these events to update the store.
  return (
    <div>
      <p>Clicks: {$count}</p>
      <div>
        <button onClick={() => ctx.emit("counter:decrement")}>-1</button>
        <button onClick={() => ctx.emit("counter:reset")}>Reset</button>
        <button onClick={() => ctx.emit("counter:increment")}>+1</button>
      </div>
    </div>
  );
});

const app = createApp(() => {
  const ctx = useContext();
  ctx.addStore(CounterStore, 0);

  return <CounterView />
});

app.mount(document.body);
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
