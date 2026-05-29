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

### `peek`

Read a getter without tracking it as a dependency.

```js
import { peek } from "@manyducks.co/dolla";

const result = compose(() => {
  const a = signalA(); // tracks signalA
  const b = peek(signalB); // reads signalB without tracking
  return a + b;
});
```

### `batch`

Group multiple signal changes into a single update. Effects run once after all changes, not after each one.

```js
import { batch } from "@manyducks.co/dolla";

batch(() => {
  setCount(5);
  setName("Alice");
  setAge(30);
  // effect only runs once after this block
});
```

### `unwrap`

Unwraps a `MaybeGetter<T>` into a plain `T`. If the value is a getter, it's called and tracked as a dependency.

```js
import { unwrap } from "@manyducks.co/dolla";

unwrap(42); // 42
unwrap(count); // current value of count, tracked
```

### `subscribe`

Subscribe to a getter and run a callback whenever its value changes. Returns an unsubscribe function.

```js
import { subscribe } from "@manyducks.co/dolla";

const unsub = subscribe(count, (value) => {
  console.log("count changed to", value);
});
// later: unsub();
```

### `sleep`

Returns a Promise that resolves after `ms` milliseconds.

```js
import { sleep } from "@manyducks.co/dolla";

await sleep(1000);
```
