# Stores

Ideas for updating the API.

```js
import { createStore, attachStore, useStore, createView } from "@manyducks.co/dolla";

const Counter = createStore(function (initialCount: number) {
  const [$value, setValue] = createState(initialCount);

  this.on("counter:increment", (e) => {
    e.stopPropagation(); // Stop this event from bubbling up to counters at higher levels (if any).
    setValue((current) => current + 1);
  });

  this.on("counter:decrement", (e) => {
    e.stopPropagation();
    setValue((current) => current - 1);
  });

  // Events can be emitted from this context in a store.
  this.emit("otherEvent");

  this.onMount(() => {
    // Setup
    // This is called based on the context the store is attached to.
    // If Dolla, it's called when the app is mounted. If ViewContext, it's called when the view is mounted.
  });
  this.onUnmount(() => {
    // Cleanup
  });

  // Context variables will be accessible on the same context (e.g. the view this is attached to and below)
  this.get("context variable");
  this.set("context variable", "context variable value");

  // Stores don't have to return anything, but if they do it becomes accessible by using `useStore(ctx, Store)`.
  return $value;
});

// Attach it to the app.
Dolla.attachStore(Counter(0));

const ExampleView = createView(function () {
  // useStore lets you access the return value
  // but the events will still be received and handled regardless
  const $count = this.useStore(Counter);

  // Convenience helper to attach and use in one step?
  const $count = this.attachAndUseStore(Counter(0));

  return html`
    <button onclick=${() => this.emit("counter:decrement")}>-1</button>
    <span>${$count}</span>
    <button onclick=${() => this.emit("counter:increment")}>+1</button>
  `;
});

// ViewContext is also still passed as a second argument if you'd rather use arrow functions to define views.
const ExampleView = createView((props, self) => {
  // useStore lets you access the return value
  // but the events will still be received and handled regardless
  const $count = self.useStore(Counter);

  return html`
    <button onclick=${() => self.emit("counter:decrement")}>-1</button>
    <span>${$count}</span>
    <button onclick=${() => self.emit("counter:increment")}>+1</button>
  `;
});
```

This means `createStore` returns a function that is called to create a Store instance. The instance is
