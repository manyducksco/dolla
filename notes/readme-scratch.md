# README

> This note will eventually become the new README. Here I'm laying out my ideal framework API.

A basic component.

```jsx
import { mount, state, derive, batch } from "@manyducks.co/dolla";

function ExampleView(props, ctx) {
  // Signals: state, derive, effect and batch

  const count = state(5);

  const doubled = derive(() => count.value * 2);

  batch(() => {
    // Perform multiple updates in one go and commit at the end.
  });

  // If effect is called in the body of a view function it will be cleaned up automatically with the view.
  ctx.effect(() => {
    console.log(nested.value);
  });

  // Emit and listen for context events.
  ctx.on("event", (e, ...args) => {
    e.cancel();
  });
  ctx.emit("event", ...args);

  // Get and set context values.
  ctx.set("context value", 5);
  ctx.get("context value");

  // Provide and use a store.
  const store = ctx.provide(someStore); // provide creates a new instance attached to this view and returns it.
  const store = ctx.use(someStore);

  return <p>{count}</p>;
}

mount(ExampleView, document.body);
```

<details open>
<summary>
  <h2>Signals API</h2>
</summary>

The signals API. Dolla's signals use explicit tracking, meaning any function where signal values are tracked take an array of the signals you want to track. This way you know exactly what depends on what at a glance without any kind of hidden tracking logic behind the scenes. You are free to `.get()` the value of a signal without worrying about untracking it first.

```jsx
import { createState } from "@manyducks.co/dolla";

const [$count, setCount] = createState(256);

$count.get(); // 256; returns the current value

const stop = $count.watch((value) => {
  // Runs once immediately, then again whenever the value changes.
});

setCount(512); // Update the value of $count. The new value is set and all watchers run synchronously.

stop(); // Stop watching for changes.
```

That is the basic signal API. Signals are all about composability. Here are some more advanced ways of working with them:

```jsx
import { createState, toState, valueOf, derive } from "@manyducks.co/dolla";

const [$count, setCount] = createState(72);

// Returns the value of the signal passed in. If the value is not a signal it is returned as is.
const count = valueOf($count);
const bool = valueOf(true);

// Creates a signal containing the value passed in. If the value is already a signal it is returned as is.
const $bool = toState(true);
const $anotherCount = toState($count);

// Derive a new signal from the value of another. Whenever $count changes, $doubled will follow.
const $doubled = derive([$count], (count) => count * 2);

// Derive a new signal from the values of several others. When any value in the list changes, $sum will be recomputed.
const $sum = derive([$count, $doubled], (count, doubled) => count + doubled);
```

The API if we call it State instead of Signal to distance from the Signal object in standardization process.

```jsx
import { createState, toState, valueOf, derive } from "@manyducks.co/dolla";

const [$count, setCount] = createState(72);

// Returns the value of the signal passed in. If the value is not a signal it is returned as is.
const count = valueOf($count);
const bool = valueOf(true);

// Creates a signal containing the value passed in. If the value is already a signal it is returned as is.
const $bool = toState(true);
const $anotherCount = toState($count);

// Derive a new signal from the value of another. Whenever $count changes, $doubled will follow.
const $doubled = derive([$count], (count) => count * 2);

// Derive a new signal from the values of several others. When any value in the list changes, $sum will be recomputed.
const $sum = derive([$count, $doubled], (count, doubled) => count + doubled);
```

States also come in a settable variety, with the setter included on the same object. Sometimes you want to pass around a two-way binding and this is what SettableState is for.

```jsx
import { createSettableState, fromSettable, toSettable } from "@manyducks.co/dolla";

// Settable states have their setter included.
const $$value = createSettableState("Test");
$$value.set("New Value");

// They can also be split into a State and Setter
const [$value, setValue] = fromSettableState($$value);

// And a State and Setter can be combined into a SettableState.
const $$otherValue = toSettableState($value, setValue);

// Or discard the setter and make it read-only using the good old toState function:
const $value = toState($$value);
```

Alternative API

```jsx
import { State } from "@manyducks.co/dolla";

const [$count, setCount] = State(72);

const count = State.unwrap($count);
const bool = State.unwrap(true);

const $bool = State.wrap(true);
const $sameCount = State.wrap($count);

const $doubled = State.from([$count], (count) => count * 2);

const $sum = State.from([$count, $doubled], (count, doubled) => count + doubled);
```

Yet another

```jsx
import Dolla from "@manyducks.co/dolla";

const [$count, setCount] = Dolla.state(72);

const count = Dolla.get($count);
const bool = Dolla.get(true);

const $bool = Dolla.toState(true);
const $sameCount = Dolla.toState($count);

const $doubled = Dolla.computed([$count], (count) => count * 2);
const $sum = Dolla.computed([$count, $doubled], (count, doubled) => count + doubled);

// or

import { state, computed, get, toState } from "@manyducks.co/dolla";

const [$count, setCount] = state(72);

const count = get($count);
const bool = get(true);

const $bool = toState(true);
const $sameCount = toState($count);

const $doubled = computed([$count], (count) => count * 2);
const $sum = computed([$count, $doubled], (count, doubled) => count + doubled);
```

Settable signals:

```jsx
import { createSettableState, createSetter, toSettableSignal, fromSettableSignal } from "@manyducks.co/dolla";

// Create a SettableSignal, which is basically a signal and its setter combined into a single object.
const $$settable = createSettableState("Example");

// The basic API is identical...
$$settable.get();
const stop = $$settable.watch((value) => {
  // ...
});
stop();

// ... except for the addition of a setter.
$$settable.set("Set me directly");

// When you already have a signal and a setter, they can be combined into one.
const $$count = toSettableSignal($count, setCount);

// This updates the original $signal value.
$$count.set(386);

// TODO: You can also split a SettableSignal into a signal and its setter.
const [$readable, setReadable] = fromSettableSignal($$settable);

// Create a custom setter. Calling this will cap the value to 100.
const setCountBounded = createSetter($count, (next, current) => {
  return Math.min(100, next);
});

setCountBounded((current) => {
  return current + 1;
});

// Or make a proxy $$doubled -- but would you actually want to proxy things like this?
const [$count, setCount] = createState(5);
const $doubled = derive([$count], (count) => count * 2);
const $$doubled = toSettableSignal(
  $doubled,
  createSetter($doubled, (next, current) => {
    setCount(next * 2);
  }),
);
```

I'm not really sure we need all of this. On the chopping block:

- The entire concept of settable signals
  - `createSettableState`
  - `toSettableSignal`
  - `fromSettableSignal`
  - `createSetter`

This makes the entire API just four functions:

- `createState`
- `derive`
- `toState`
- `valueOf`

</details>
