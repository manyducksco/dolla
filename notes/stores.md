# Stores

Ideas for updating the API.

---

What about a global stores registry? Basically just a global object you can import and register stores on, then get them later. Global (not scoped to views). You can still use `provide` and `get` on view contexts in the same exact way if you want scoped stores.

This is a replacement for the current way of providing global stores on the Dolla object. The Dolla object is going away in future API versions.

```ts
import { Stores, Views } from "@manyducks.co/dolla";

Stores.provide(SomeStore, {
  /* options */
});

const some = Stores.get(SomeStore);

const SomeStore = Stores.define(() => {});

// Could also have views be defined this way.
const SomeView = Views.define<SomeProps>((props, ctx) => {});

// Register as a custom element.
Views.register("some-view", SomeView);
```

---

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
