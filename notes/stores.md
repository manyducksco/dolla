# Stores

Ideas for updating the API.

```js
function CounterStore(initialCount = 0, ctx) {
  const [$value, setValue] = createState(initialCount);

  ctx.on("counter:increment", (e) => {
    e.stop(); // Stop this event from bubbling up to counters at higher levels (if any).
    setValue((current) => current + 1);
  });

  ctx.on("counter:decrement", (e) => {
    e.stop();
    setValue((current) => current - 1);
  });

  // Events can be emitted from this context in a store.
  ctx.emit("otherEvent");

  ctx.onMount(() => {
    // Setup
    // This is called based on the context the store is attached to.
    // If Dolla, it's called when the app is mounted. If ViewContext, it's called when the view is mounted.
  });
  ctx.onUnmount(() => {
    // Cleanup
  });

  // Context variables will be accessible on the same context (e.g. the view this is attached to and below)
  ctx.get("context variable");
  ctx.set("context variable", "context variable value");

  // Stores don't have to return anything, but if they do it becomes accessible with `ctx.use(Store)`.
  return $value;
}

// Attach it to the app.
Dolla.provide(CounterStore, 0);

function ExampleView(props, ctx) {
  // ctx.use lets you access the return value
  // but the events will still be received and handled regardless
  const $count = ctx.use(Counter);

  return html`
    <button onclick=${() => this.emit("counter:decrement")}>-1</button>
    <span>${$count}</span>
    <button onclick=${() => this.emit("counter:increment")}>+1</button>
  `;
}
```
