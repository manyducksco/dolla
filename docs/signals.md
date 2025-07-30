# ⚡ Dolla Signals: The Main Vibe

Wanna know how Dolla works? It's all about **Signals**. Fr, they're the most important thing to get. They're like little magic boxes that hold your data, and they're the reason Dolla is so fast and reactive without all the drama of other frameworks.

## So, what even IS a Signal?

A signal is just a little box that holds a value. That's it. But it's a special box.

- When you **read** from the box (get its value), it takes notes on who's asking.
- When you **write** to the box (change its value), it automatically tells everyone who was asking, "yo, I changed\!"

This is the core of Dolla's reactivity. It's a system of "subscribers" and "publishers." When a signal changes, it publishes an update, and only the exact parts of your app that subscribed to that signal will react. No wasted effort.

This is why Dolla doesn't need a Virtual DOM. It doesn't have to guess what changed; the signals tell it _exactly_ what changed and where.

## Making Signals in Components: `useSignal`

The main way you'll make a signal _inside a component_ is with the `useSignal` hook. It gives you back a pair of things in an array, just like React's `useState`.

```jsx
import { useSignal } from "@manyducks.co/dolla";

function MyComponent() {
  //  [getter, setter]
  const [$count, setCount] = useSignal(0);
  // ...
}
```

- `$count`: This is the **getter**. It's a function that you call to get the signal's current value. We use a `$` at the start by convention to make signals easy to spot.
- `setCount`: This is the **setter**. It's a function you call to update the signal's value.

### Reading and Writing

Here's the flow:

```jsx
const [$count, setCount] = useSignal(0);

// To READ the value in your JS, call the getter function:
console.log($count()); // -> 0

// To WRITE a new value, call the setter:
setCount(1);
console.log($count()); // -> 1

// The setter can also take a function, just like in React:
setCount((currentCount) => currentCount + 1);
console.log($count()); // -> 2
```

**Super Important Rule:** In your JSX, you can usually just drop the signal right in (`<p>{$count}</p>`). Dolla is smart enough to know it needs to read the value there. But in your JavaScript code (like in an `useEffect` or an event handler), you **must** call it like a function to get the value (`$count()`).

## Derived Signals: `useMemo`

Sometimes you have state that depends on _other_ state. For example, a `fullName` that's made from a `firstName` and a `lastName`. You don't want to have to manually update `fullName` every time one of the other two changes. That's a job for `useMemo`.

`useMemo` creates a new, read-only signal that automatically updates when its dependencies change.

```jsx
import { useSignal, useMemo } from "@manyducks.co/dolla";

function Greeter() {
  const [$firstName, setFirstName] = useSignal("John");
  const [$lastName, setLastName] = useSignal("Doe");

  // This is a derived signal. It's subscribed to $firstName and $lastName.
  const $fullName = useMemo(() => {
    console.log("Recalculating full name...");
    return `${$firstName()} ${$lastName()}`;
  });

  return (
    <div>
      <p>Full Name: {$fullName}</p>
      <input value={$firstName} onInput={(e) => setFirstName(e.target.value)} />
      <input value={$lastName} onInput={(e) => setLastName(e.target.value)} />
    </div>
  );
}
```

In this example, the "Recalculating..." message will only log when you type in one of the input boxes. If you just click around, the memo doesn't re-run because its dependencies (`$firstName` and `$lastName`) haven't changed. It's super efficient.

## Automatic Tracking: The Real Magic

This is the part that makes Dolla so chill to work with. When you use a signal inside a `useMemo` or a `useEffect`, Dolla automatically figures out that the effect/memo depends on that signal. You don't have to tell it.

```jsx
const [$count, setCount] = useSignal(0);
const [$name, setName] = useSignal("User");

// This effect uses both $count and $name
useEffect(() => {
  console.log(`The count is ${$count()} for user ${$name()}`);
});
```

In this example, Dolla knows that this `useEffect` is subscribed to **both** `$count` and `$name`. If you call `setCount(1)`, the effect will re-run. If you call `setName("Alice")`, the effect will also re-run. You don't have to manage a dependency array like in React. It just works.

## Grouping Updates: `batch`

Imagine you need to update a bunch of signals all at once.

```jsx
setFirstName("Jane");
setLastName("Smith");
setAge(30);
```

If you do this, you might cause three separate updates, and any effects that depend on these signals might run three times. That's not ideal.

The `batch` function lets you group all these updates together. Dolla will perform all the changes, and then at the very end, it will run all the necessary effects just a single time.

```jsx
import { batch } from "@manyducks.co/dolla";

const updateUser = () => {
  batch(() => {
    setFirstName("Jane");
    setLastName("Smith");
    setAge(30);
  });
  // Now, any effects that depend on these three signals will only run once!
};
```

It's a great tool for keeping your app snappy when you have complex state changes.

## Standalone Signals: Going Hookless

Okay, so all the hooks like `useSignal` and `useMemo` are great, but they have one rule: you can only use them inside a component (a View, Store, or Mixin). But what if you need reactivity _outside_ of a component?

Maybe you wanna make a global store in its own file, or you're just messing around in a plain `.js` file. That's where the standalone signal functions come in. They're the same core magic, just without the "use" prefix.

### `signal(initialValue?)`

This is the hookless version of `useSignal`. It does the exact same thing: creates a reactive box and gives you a `[getter, setter]` pair.

```jsx
import { signal, effect } from "@manyducks.co/dolla";

// We're not in a component, just a regular JS file!
const [$time, setTime] = signal(new Date());

// We can use the standalone `effect` to watch it.
effect(() => {
  console.log("The time is now:", $time());
});

setInterval(() => {
  setTime(new Date());
}, 1000);
```

### `writable(initialValue?)`

This is another way to make a signal. Instead of a `[getter, setter]` pair, it gives you back a single function that's both a getter _and_ has a `.set()` method. It's just a different flavor, sometimes it's cleaner.

```jsx
import { writable } from "@manyducks.co/dolla";

const $name = writable("Guest");

console.log($name()); // -> "Guest"

$name.set("Alice");
console.log($name()); // -> "Alice"
```

### `memo(compute)`

The hookless version of `useMemo`. It takes a function and gives you back a new, read-only signal that updates when its dependencies do.

```jsx
import { signal, memo } from "@manyducks.co/dolla";

const [$firstName, setFirstName] = signal("John");
const [$lastName, setLastName] = signal("Doe");

const $fullName = memo(() => `${$firstName()} ${$lastName()}`);

console.log($fullName()); // -> "John Doe"
setFirstName("Jane");
console.log($fullName()); // -> "Jane Doe"
```

### `effect(callback)`

The hookless version of `useEffect`. It runs your callback once, tracks any signals you use inside it, and then re-runs the callback whenever those signals change.

**Super Important Rule:** The standalone `effect` function returns an `unsubscribe` function. If you're using `effect` outside of a component, you're responsible for calling this cleanup function yourself to prevent memory leaks\! (The `useEffect` hook does this for you automatically when the component unmounts).

```jsx
import { signal, effect } from "@manyducks.co/dolla";

const [$count, setCount] = signal(0);

const unsubscribe = effect(() => {
  console.log("Count changed:", $count());
});

setCount(1); // logs "Count changed: 1"

// Later, when you're done...
unsubscribe();
setCount(2); // Nothing logs, because we unsubscribed.
```

### Utility Functions: The Nitty Gritty

These are some super useful functions for working with signals.

- **`get(value)`:** This function "unwraps" a value. If you give it a signal, it gives you the value inside. If you give it a plain value, it just gives it right back. **Crucially, if you're inside a reactive scope like `useEffect`, `get` will track the signal as a dependency.**
- **`untracked(fn)`:** This function also "unwraps" a value from a signal, but it does it in "stealth mode." It tells Dolla, "hey, get me this value, but don't make me a subscriber." **It's the equivalent of `get`, but it explicitly opts out of tracking.**

Here's the difference in action:

```jsx
import { get, untracked, signal, effect } from "@manyducks.co/dolla";

const [$count, setCount] = signal(0);
const [$name, setName] = signal("User");

effect(() => {
  // We're using `get`, so this effect is now subscribed to $count.
  console.log(`Count changed: ${get($count)}`);

  // We're using `untracked`, so this effect is NOT subscribed to $name.
  const name = untracked(() => $name());
  console.log(`(The user is currently ${name})`);
});

// This will trigger the effect to re-run.
setCount(1);

// This will NOT trigger the effect.
setName("Alice");
```

- **`readable(value)`:** This does the opposite of `get`. It "wraps" a value, making sure you always have a signal to work with. If you give it a signal, it just returns it. If you give it a plain value, it creates a new read-only signal with that value. This is great for writing flexible functions that can accept either a signal or a plain value as an input.

  ```jsx
  import { readable, signal } from "@manyducks.co/dolla";

  // Give it a plain value, get a signal back.
  const $name = readable("Alice");
  console.log($name()); // -> "Alice"

  // Give it an existing signal, get the same signal back.
  const [$count, setCount] = signal(10);
  const $readableCount = readable($count);
  console.log($readableCount === $count); // -> true
  ```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
