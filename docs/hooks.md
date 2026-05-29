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
