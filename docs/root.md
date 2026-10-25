# App root and plugins

`createRoot` mounts a Dolla app into a DOM element.

```jsx
import { createRoot } from "@manyducks.co/dolla";

function App() {
  return <h1>Hello</h1>;
}

await createRoot("#app").mount(App);
```

`createRoot` accepts a selector string or an `Element`:

```js
const app = document.getElementById("app");
if (!app) throw new Error("Missing #app element");

await createRoot(app).mount(App);
```

## Options

| Option | Type | Description |
| --- | --- | --- |
| `debug` | `boolean` | Adds `data-view` attributes, records signal creation locations for error messages, and enables flush timing and slow-flush label breakdowns. See [Debugging](./debugging.md). |

## `mount(content)`

`mount` accepts either a View function or any `Renderable`:

```jsx
await createRoot("#app").mount(App);
await createRoot("#app").mount(<main>Static content</main>);
```

`mount` returns a `Promise<void>`. It awaits all registered plugins before mounting the content. Calling `mount` while the root is already mounted is a no-op.

If the target element already hosts a Dolla root, the previous root is unmounted before the new content is mounted, preventing duplicate app trees.

## `unmount()`

```js
const root = createRoot("#app");
await root.mount(App);

root.unmount();
```

`unmount` detaches the mounted DOM, cleans up contexts and effects, and removes the root marker. It is safe to call when nothing is mounted.

## Plugins

A plugin is a function that receives the root context. It can attach services, stores, or lifecycle behavior:

```js
import { onCleanup, onMount } from "@manyducks.co/dolla";

const analytics = (context) => {
  context.track = (event) => {
    // send event
  };

  onMount(context, () => {
    context.track("app:mount");
  });

  onCleanup(context, () => {
    context.track("app:unmount");
  });
};

const root = createRoot("#app")
  .plugin(analytics)
  .plugin(createRouter({ routes }));

await root.mount(App);
```

Plugins are invoked in registration order. If a plugin returns a promise, `mount` awaits it along with the others.

Register plugins before calling `mount`; plugins added afterward are not run.

`DollaPlugin` is typed as:

```ts
type DollaPlugin = (context: Context) => any;
```

## Errors

A rejected plugin promise rejects `mount`. A view that throws while rendering also rejects `mount`. In that case the root may be partially mounted; call `unmount()` before retrying if needed.

```jsx
try {
  await createRoot("#app").mount(App);
} catch (error) {
  console.error("Failed to mount", error);
}
```

Errors raised by effects and DOM updates are reported instead of thrown from setters. Pass `onError` to receive them:

```jsx
const root = createRoot("#app", {
  onError(error) {
    console.error(error);
  },
});
```

`onError` receives a [`SignalError`](./errors.md#signalerror). Without a handler, errors go to the default reporter (`reportError()` in browsers, `console.error()` elsewhere). See [Errors](./errors.md) for details.

## Next steps

- [Getting started](./getting-started.md) — project setup
- [Components](./components.md) — views and stores
- [Errors](./errors.md) — effect error reporting and `SignalError`
- [HMR](./hmr.md) — development-time view replacement
