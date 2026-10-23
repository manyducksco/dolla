# Hooks

Hooks are just functions that take a Context as the first argument. Following this convention makes hooks composable; a hook can call other hooks by passing the context it was called with.

## Lifecycle Hooks

| Hook | Description |
|---|---|
| `onMount(context, callback)` | Registers a callback to run when the component is mounted into the DOM. |
| `onCleanup(context, callback)` | Registers a callback to run when the component is removed from the DOM. |
| `onEffect(context, callback)` | Creates an auto-tracking effect scoped to the component lifecycle. Re-runs whenever tracked signals change. `callback` may return a cleanup function. |
| `onEffect(context, callback, deps)` | Creates a deps-array effect — `callback` receives the unwrapped dependency values and re-runs only when deps change. |

Effects created with `onEffect` are automatically cleaned up when the component unmounts.

### Suspension Hooks

These hooks only fire for content inside a `keepAlive` branch side (see `showIf` / `hideIf`):

| Hook | Description |
|---|---|
| `onSuspend(context, callback)` | Runs when the nearest keep-alive scope is suspended. For already-mounted content, the DOM is still connected when this runs. |
| `onResume(context, callback)` | Runs when the nearest keep-alive scope is resumed. The DOM has been reattached when this runs. |
| `isSuspended(context)` | Returns whether the nearest keep-alive scope is currently suspended. This is a plain boolean read, not a reactive value. |

Suspension is not unmounting. `onSuspend` / `onResume` run on every hide/show, while `onCleanup` runs only when the content is actually disposed. Effects and timers keep running while suspended, so use these hooks to pause polling, playback, or other background work:

```js
function Poller() {
  let timer;
  const stop = () => clearInterval(timer);
  const start = () => { timer = setInterval(refresh, 5000); };

  onMount(this, start);
  onSuspend(this, stop);
  onResume(this, start);

  return html`<p>${data}</p>`;
}
```

If a component — or a hook — is added while its keep-alive scope is already suspended, `onSuspend` runs immediately after registration. In that case the content is already detached when the hook fires.

## Context Hooks

| Hook | Description |
|---|---|
| `createContext(parent, values?)` | Creates a new context object that prototypally inherits from `parent`. |
| `mountContext(context)` | Fires all mount listeners registered on a context. |
| `cleanupContext(context)` | Fires all cleanup listeners registered on a context. |
| `getNearestViewNode(context)` | Returns the `ViewNode` of the nearest view up the context chain. |
| `getRootElement(context)` | Returns the parent DOM element of the root the component is mounted in. |

## Store Hooks

| Hook | Description |
|---|---|
| `addStore(context, store, props?)` | Creates a store instance on the context and returns its value. |
| `getStore(context, store)` | Retrieves the nearest store instance from the context chain. |
| `hasStore(context, store)` | Checks if a store instance is available on this context or up the chain. |
| `hasOwnStore(context, store)` | Checks if a store instance is on this exact context. |

## Debug

| Hook | Description |
|---|---|
| `getDebug(context, ...tagEntries)` | Gets a debug logger from a context, using the context name. |
