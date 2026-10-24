# Hooks

Hooks are functions that take a Context as the first argument. Following this convention makes hooks composable; a hook can call other hooks by passing the context it was called with.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

`this` is the same context object, so `onMount(this, ...)` works inside a function declaration. The examples use the explicit `context` argument because it is easier to follow and works with arrow functions.

## Lifecycle Hooks

| Hook | Description |
| --- | --- |
| `onMount(context, callback)` | Registers a callback to run when the component is mounted into the DOM. |
| `onCleanup(context, callback)` | Registers a callback to run when the component is removed from the DOM. |
| `onEffect(context, callback)` | Creates an auto-tracking effect scoped to the component lifecycle. Re-runs whenever tracked signals change. `callback` may return a cleanup function. |
| `onEffect(context, callback, deps)` | Creates a deps-array effect — `callback` receives the unwrapped dependency values and re-runs only when deps change. |

Effects created with `onEffect` are automatically cleaned up when the component unmounts. Hooks should be registered while the view is being constructed; registering them later may miss the lifecycle event. `onCleanup` is **not** called when a `keepAlive` branch is hidden; see [Visibility Hooks](#visibility-hooks). See [When updates run](./concepts.md#when-updates-run) for ordering.

Use `onEffect` inside views and stores. For code outside the context tree, see [Standalone effects](./advanced.md#standalone-effects).

## Custom hooks

A custom hook is a function that takes the context and calls other hooks. This is how you share lifecycle-aware logic between views.

```jsx
function useCounter(context) {
  const [getCount, setCount] = createAtom(0);

  const increment = () => setCount((count) => count + 1);
  const reset = () => setCount(0);

  onCleanup(context, () => {
    // Optional cleanup for resources created by the hook.
  });

  return { getCount, increment, reset };
}

function Counter(props, context) {
  const { getCount, increment, reset } = useCounter(context);

  return (
    <div>
      <p>{getCount}</p>
      <button onClick={increment}>+1</button>
      <button onClick={reset}>Reset</button>
    </div>
  );
}
```

## Visibility Hooks

Visibility hooks are paired transitions. They work for any context, not only inside `keepAlive`:

| Hook | Description |
| --- | --- |
| `onShow(context, callback)` | Runs after the content becomes visible. Fires on initial visible mount and after each restore from hidden. The DOM is attached when it runs. |
| `onHide(context, callback)` | Runs when content becomes hidden. For `keepAlive`, this is before its DOM is detached. Fires only after a previous `onShow`. On unmount, it runs only if the content is currently visible, before `onCleanup`. |
| `isVisible(context)` | Returns `true` when the context is mounted and not hidden. A plain boolean read, not reactive. |

`onShow` and `onHide` alternate. Content that mounts hidden gets neither hook until it is shown. Content unmounted while hidden gets `onCleanup` only. `isMounted(context)` remains true while content is hidden.

"Visible" here means mounted and not hidden by `keepAlive`; it does not check whether the root element is attached to the browser document. If you mount into a detached container, `isVisible` can be true.

Hiding is not unmounting. Effects and timers keep running while hidden, so use these hooks to pause polling, playback, or other background work:

```jsx
function Poller(props, context) {
  let timer;
  const [getData, setData] = createAtom("...");

  const refresh = () => setData("updated");
  const stop = () => clearInterval(timer);
  const start = () => {
    timer = setInterval(refresh, 5000);
  };

  onShow(context, start);
  onHide(context, stop);

  return <p>{getData}</p>;
}
```

Start visibility-dependent work in `onShow`, not `onMount`. If setup must happen regardless of visibility, use `onMount` and guard it with `isVisible(context)`.

Register hooks while the view is being constructed. If you register `onShow` after the content is already visible, it runs immediately; hooks registered while hidden wait until the next show.

### Which lifecycle hook?

| Need | Hook |
| --- | --- |
| Run once when the context is mounted | `onMount` |
| Run once when the context is disposed | `onCleanup` |
| Start work whenever content becomes visible | `onShow` |
| Stop work whenever content becomes hidden | `onHide` |
| Keep a resource for the whole lifetime, but pause it while hidden | Create in `onMount`, pause in `onHide`, continue in `onShow`, destroy in `onCleanup` |

## Context Hooks

| Hook | Description |
| --- | --- |
| `isMounted(context)` | Returns whether the context lifecycle is mounted. This replaces the old `context.isMounted` field. |
| `createContext(parent, values?)` | Creates a new context object that prototypally inherits from `parent`. |
| `mountContext(context)` | Fires all mount listeners registered on a context. |
| `cleanupContext(context)` | Fires all cleanup listeners registered on a context. |
| `getNearestViewNode(context)` | Returns the `ViewNode` of the nearest view up the context chain. |
| `getRootElement(context)` | Returns the parent DOM element of the root the component is mounted in. |

## Store Hooks

| Hook | Description |
| --- | --- |
| `addStore(context, store, props?)` | Creates a store instance on the context and returns its value. |
| `getStore(context, store)` | Retrieves the nearest store instance from the context chain. |
| `hasStore(context, store)` | Checks if a store instance is available on this context or up the chain. |
| `hasOwnStore(context, store)` | Checks if a store instance is on this exact context. |

## Debug

| Hook | Description |
| --- | --- |
| `getDebug(context, ...tagEntries)` | Gets a debug logger from a context, using the context name. |

See [Debugging](./debugging.md) for log levels, filters, and debug mode.

## Next steps

- [Effects](./effects.md) — `onEffect`, auto-tracking, deps arrays, cleanup
- [Components](./components.md) — views, stores, control flow
- [Mental model](./concepts.md#when-updates-run) — hook ordering
