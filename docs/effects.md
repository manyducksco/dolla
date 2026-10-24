# Effects

Effects run side-effect code in response to state changes. Inside a view or store, use `onEffect(context, callback)`. It tracks the getters read in the callback, re-runs when they change, and is cleaned up automatically when the context unmounts.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Auto-tracking effect

```jsx
import { createAtom, onEffect } from "@manyducks.co/dolla";

function Counter(props, context) {
  const [getCount, setCount] = createAtom(0);

  onEffect(context, () => {
    console.log("Count is:", getCount()); // getCount() is tracked
  });

  return <button onClick={() => setCount((count) => count + 1)}>{getCount}</button>;
}
```

The effect runs when the view's context mounts, then whenever `getCount` changes. No dependency array is needed.

### Cleanup

The callback may return a cleanup function that runs before the next invocation and when the context unmounts:

```jsx
onEffect(context, () => {
  const id = setInterval(() => {
    // ...
  }, 1000);

  return () => clearInterval(id);
});
```

## Deps-array effect

Pass an array of getters as the third argument to avoid auto-tracking. The callback receives the unwrapped values:

```jsx
onEffect(
  context,
  (count, name) => {
    console.log(`${name}: ${count}`);
  },
  [getCount, getName],
);
```

The effect only re-runs when the values of the listed getters change.

## When it runs

`onEffect` registers the effect on mount, after the view's DOM is mounted. It is the usual choice inside a view or store.

- Use `onEffect` for work that should re-run when tracked state changes.
- Use `onMount` for one-time setup that does not need to re-run.
- Use `onCleanup` for teardown that is not tied to an effect.

See [When updates run](./concepts.md#when-updates-run) for the difference between synchronous effects and microtask DOM updates.

## Outside the context tree

If you need an effect where there is no view or store context — for example, in a module-level integration or a test harness — use the standalone `createEffect` described in [Standalone effects](./advanced.md#standalone-effects). Prefer `onEffect` whenever a context is available.

## Next steps

- [Hooks](./hooks.md) — lifecycle and visibility hooks
- [Reactivity](./reactivity.md) — atoms, `compose`, `batch`, `peek`
- [Mental model](./concepts.md#when-updates-run) — update timing
