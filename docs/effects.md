# Effects

Effects run side-effect code in response to state changes. Dolla provides two overloads for `createEffect` and a lifecycle-scoped variant `onEffect`.

## Auto-tracking effect

When called with a single function, `createEffect` tracks any getters read inside the callback. The effect re-runs whenever a tracked value changes.

```js
import { createEffect, createAtom } from "@manyducks.co/dolla";

const [count, setCount] = createAtom(0);

const stop = createEffect(() => {
  console.log("Count is:", count()); // count() is tracked
});

setCount(1); // logs "Count is: 1"
setCount(2); // logs "Count is: 2"

stop(); // manually stop the effect
```

### Cleanup

The callback may return a cleanup function that runs before the next invocation and when the effect is stopped:

```js
createEffect(() => {
  const timer = setInterval(() => { /* ... */ }, 1000);
  return () => clearInterval(timer);
});
```

## Deps-array effect

Pass a second argument — an array of getters — to avoid auto-tracking. The callback receives the unwrapped values:

```js
createEffect((count, name) => {
  console.log(`${name}: ${count}`);
}, [count, name]);
```

The effect only re-runs when the values of the listed getters change.

## Lifecycle-scoped effects

`createEffect` is standalone. Inside a component, use `onEffect(context, callback)` — it's automatically cleaned up when the component unmounts:

```js
import { onEffect, html } from "@manyducks.co/dolla";

function Timer() {
  const [elapsed, setElapsed] = createAtom(0);

  onEffect(this, () => {
    const id = setInterval(() => setElapsed((c) => c + 1), 1000);
    return () => clearInterval(id);
  });

  return html`<p>${elapsed}s</p>`;
}
```

`onEffect` supports both overloads:

```js
onEffect(this, callback);              // auto-tracking
onEffect(this, callback, [dep1, dep2]); // deps array
```
