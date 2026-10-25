# Errors

Dolla separates errors caused by **updating state** from errors caused by **effects reacting to that state**.

- An error in a setter's update function still throws. The update itself failed.
- An error in a render or direct computed read still throws. Rendering cannot continue with a bad value.
- An error in an effect is **reported**, not thrown from the setter. The state change already happened, and other effects must still run.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Reporting effect errors

Pass `onError` to `createRoot`:

```jsx
import { createRoot } from "@manyducks.co/dolla";

const root = createRoot("#app", {
  onError(error) {
    console.error(error);
    // send to telemetry, show a toast, etc.
  },
});

await root.mount(App);
```

`onError` receives a `SignalError`. Child contexts inherit the root handler automatically.

If no handler is configured, the default reporter uses `reportError()` in browsers — so the error appears in DevTools, `window.onerror`, and the Vite overlay — and falls back to `console.error()` elsewhere.

## What a reported error looks like

```text
SignalError: Cannot read properties of undefined (reading 'name')

  effect "TodoList → repeat:items"
  at TodoRow (src/TodoRow.tsx:42:18)

Reactive context
  1. effect "TodoList → repeat:items"  created at src/TodoList.tsx:31
  2. composed "visibleTodos"           created at src/TodoList.tsx:24

Triggered from
  at setTodos (src/store.ts:18:5)
  at onSubmit (src/TodoForm.tsx:55:9)

Cause: TypeError: Cannot read properties of undefined (reading 'name')
```

The message answers three questions:

- **What failed** — the original message and throw site.
- **What reactive code was running** — the effect and computed names and where they were created.
- **What triggered it** — the setter or event-handler frame that initiated the flush.

## `SignalError`

`SignalError` wraps the original error without mutating it:

```ts
import { SignalError, isSignalError } from "@manyducks.co/dolla";

function handle(error: SignalError) {
  console.log(error.phase);       // "effect", "computed", "update", ...
  console.log(error.contextName); // nearest view/store name
  console.log(error.effect);      // { type, name } when available
  console.log(error.scopes);      // reactive context chain
  console.log(error.trigger);     // update-trigger frames
  console.log(error.cause);       // the original Error
  console.log(error.original);    // the original thrown value
}
```

Use `isSignalError(error)` rather than `instanceof` if your app may load more than one copy of Dolla.

Because the original error is available in `cause`, type checks still work:

```js
if (error.cause instanceof RangeError) {
  // ...
}
```

## What still throws

```js
const [count, setCount] = createAtom(0);

setCount(() => {
  throw new Error("bad update");
}); // throws: the update function failed

const value = compose(() => {
  throw new Error("bad computed");
});

value(); // throws a SignalError
```

An effect error never propagates out of `setCount()`.

## Computed errors are sticky

If a computed getter throws, the error is cached until the computed is recomputed successfully:

```js
const total = compose(() => {
  if (!ready()) throw new Error("not ready");
  return items().length;
});

total(); // throws
total(); // throws again, even without a dependency change
```

Once a dependency changes, the next read tries again. Parent effects also retry when the computed recovers.

## Batch behavior

Effects run after the batch callback finishes. If both the callback and an effect fail:

- The effect error is reported through `onError`.
- The callback error is rethrown from `batch`.
- If both the callback and an internal flush error throw, `batch` throws an `AggregateError` containing both.

## Async callbacks

Effects must be synchronous. Returning a Promise reports a `SignalError` explaining the problem and catches any later rejection:

```js
onEffect(context, async () => {
  // reported: effects must be synchronous
});
```

Use a cleanup function with an `AbortController` for async work:

```js
onEffect(context, () => {
  const controller = new AbortController();

  fetch("/api/items", { signal: controller.signal })
    .then((response) => response.json())
    .then(setItems)
    .catch(() => {});

  return () => controller.abort();
});
```

## Testing effect errors

Capture errors with `onError` instead of wrapping setters in `try/catch`:

```js
const errors = [];
const root = createRoot("#app", { onError: (error) => errors.push(error) });

await root.mount(App);
setCount(1);

expect(errors).toHaveLength(1);
expect(errors[0]).toBeInstanceOf(SignalError);
expect(errors[0].cause).toBeInstanceOf(RangeError);
```

For standalone signal tests, `setErrorHandler` is available from `@manyducks.co/dolla/internals`:

```js
import { setErrorHandler } from "@manyducks.co/dolla/internals";

const errors = [];
setErrorHandler((error) => errors.push(error));
// ...run signal code...
setErrorHandler(null);
```

## Next steps

- [Effects](./effects.md) — effect timing and cleanup
- [App root](./root.md) — `onError`, plugins, mount and unmount
- [Debugging](./debugging.md) — loggers and debug mode
- [Advanced internals](./advanced.md) — standalone effects and custom nodes
