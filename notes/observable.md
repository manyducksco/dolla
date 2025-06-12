# Observable

Signals have some downsides, like if you call them inside a function, and you then call that function inside a tracking context, it can cause the tracking context to re-run unexpectedly. You then have to defensively call things inside `untracked` to avoid tracking deeply nested signal getters. It's not unmanageable but it's extremely surprising and unintuitive when you first run into it. It's a new and unnecessary consideration that makes code feel less safe and predictable.

I'm considering using Observable (or my own extended version of it) as a basis for a state management system. Still built on top of `alien-signals` but with explicit tracking of signal values. It could look something like the following.

This would probably be best as a separate library, maybe called `@manyducks.co/atomic`.

Going back to the atom/compose terminology.

```js
// Define an atom, the basic value holder object.
const count = atom(5);

// Atoms have a `value` field that is writable. This is not tracked by default.
count.value; // 5
count.value = 12;
count.value; // 12

// Implements the Observable interface.
const subscription = count.subscribe({
  next: (value) => {
    console.log("count is now", value);
  },
  error: (error) => {},
  completed: () => {},
});
subscription.closed; // boolean
subscription.unsubscribe();

// Like `value` getter but tracks count in a signal tracking scope.
count.track(); // 12

// Can be closed which completes all subscribers and will throw an error if a new value is set.
count.close();
```

Atoms can be composed.

```js
// You explicitly pass a dependencies array at the end, similar to React.
// Dependencies will be tracked and the compose function re-run any time they receive a new value.
const doubled = composed((prev) => count.value * 2, [count]);

// Read-only value.
doubled.value;

// Observable
const subscription = doubled.subscribe((value) => {
  // ...
});

// Trackable
doubled.track();

// Completes subscriptions, untracks deps and prevents receiving any new values.
doubled.close();
```

Effects work basically the same as `composed` but they return a cancel function instead of a value.

```js
const cancel = effect(() => {
  console.log(`count is now ${count.value}`);
}, [count]);

cancel();
```

Other thoughts:

```js
// You can name observables for debugging purposes. If one of them throws an error it can include the name.
const count = atom(5).named("count");

// Maybe even named effects.
const cancel = effect(() => {
  console.log(`count is now ${count.value}`);
}, [count]).named("countReader");

// Promise-based await next? This will resolve when count.value is set.
// If the subscription errors it rejects with that error. If the subscription completes it rejects with an error to indicate that.
const nextCount = await count.nextValue();

// Filter and signal. Wait up to 5 seconds for next even value.
const controller = new AbortController();
setTimeout(controller.abort, 5000);
const nextEven = await count.nextValue({
  filter: (value) => value % 2 === 0,
  signal: controller.signal,
  // or timeout: 5000
});
// Resolves to null if aborted or timed out.

// Batching

const count1 = atom(5);
const count2 = atom(12);

effect(() => {
  console.log(`total: ${count1.value + count2.value}`);
}, [count1, count2]);

// This causes the effect to run twice
count1.value = 50;
count2.value = 8;

// A batch suspends effects until it concludes; this runs the effect once
batch(() => {
  count1.value = 50;
  count2.value = 8;
});

// Deep reactivity
const data = atom(
  {
    users: [
      { id: 1, name: "Tony" },
      { id: 2, name: "Morgan" },
    ],
  },
  { deep: true },
);

// These updates trigger effects and subscriptions.
// By default only setting `.value` directly will trigger notifications.
data.value.users[0].name = "Bon";
data.value.users.find((user) => user.id === 1).name = "Tony";

// Then in theory, if you referenced one of the values
const morgan = data.value.users.find((user) => user.id === 2);

// And passed that around and modified it that would also still be reactive to the original atom.
// I don't know if this is a good idea.
morgan.name = "AKLSJDAKSD";
```

## What would Dolla look like with this?

```jsx
function CounterView() {
  const count = atom(0);

  const increment = () => count.value++;
  const decrement = () => count.value--;

  return (
    <div>
      Counter: {count}
      <button onClick={increment}>+1</button>
      <button onClick={decrement}>-1</button>
    </div>
  );
}

function ExampleView(props, ctx) {
  const name = atom("");

  // Update local name whenever props.name changes
  ctx.effect(() => {
    name.value = props.name.value;
  }, [props.name]);

  // Update greeting whenever local name changes
  const greeting = composed(() => `Hello, ${name.value}`, [name]);

  return (
    <div>
      <span>{greeting}</span>
      <input value={name} onInput={(e) => (name.value = e.target.value)} />
    </div>
  );
}
```

## TypeScript

- `Atom<T>` for the basic building block with a writable value.
- `Composed<T>` for a derived state based on other `Atom<T>` and `Composed<T>` values.
- `Atomic<T>` to encompass the basic API of both `Atom<T>` and `Composed<T>`.
