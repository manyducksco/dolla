# Utilities

## Temporal control flow

### `debounce`

Creates a debouncer that delays calling a function until after a quiet period.

```js
import { debounce } from "@manyducks.co/dolla";

// Bound — attaches a specific function
const debouncedLog = debounce(300, (msg) => console.log(msg));
debouncedLog.call("hello"); // fires after 300ms of no calls

// Unbound — call with any function
const debouncer = debounce(300);
debouncer.call(() => console.log("hello"));

debouncer.flush(); // immediately execute pending call
debouncer.cancel(); // cancel pending call
```

Options:

```js
const debouncer = debounce(300, fn, {
  signal: abortController.signal, // auto-cancel on abort
  context: myContext, // auto-cancel on context unmount
});
```

### `throttle`

Creates a throttler that limits how often a function can be called.

```js
import { throttle } from "@manyducks.co/dolla";

// Bound
const throttledLog = throttle(1000, (msg) => console.log(msg));
throttledLog.call("hello"); // fires immediately, then blocks for 1000ms
throttledLog.call("world"); // blocked, returns false

throttledLog.reset(); // resets the throttle timer

// Unbound
const throttler = throttle(1000);
throttler.call(() => console.log("hello"));
```

## Reactivity helpers

`peek`, `batch`, `unwrap`, `subscribe`, and `createSetter` are documented in [Reactivity](./reactivity.md).

## `sleep`

Returns a Promise that resolves after `ms` milliseconds.

```js
import { sleep } from "@manyducks.co/dolla";

await sleep(1000);
```
