## ⚡ Reactive Updates with `Signals`

Dolla sets out to solve the challenge of keeping your UI in sync with your data. All apps have state that changes at runtime, and your UI must update itself to stay in sync with that state as it changes. JavaScript frameworks all have their own ways of doing this, but there are two main ones; virtual DOM and signals. Dolla follows the Signals philosophy.

[React](https://react.dev) and similar frameworks make use of a [virtual DOM](https://svelte.dev/blog/virtual-dom-is-pure-overhead), in which every state change causes a "diff" of the real DOM nodes on the page against a lightweight representation of what those nodes _should_ look like, followed by a "patch" where the minimal updates are performed to bring the DOM in line with the ideal virtual DOM.

[Solid](https://www.solidjs.com) and similar frameworks make use of [signals](https://dev.to/this-is-learning/the-evolution-of-signals-in-javascript-8ob), which are containers for data that will change over time. Signal values are accessed through special getter functions that can be called inside of a "scope" to track their values. When the value of a tracked signal changes, any computations that happened in scopes that depend on those signals are re-run. In an app like this, all of your DOM updates are performed with pinpoint accuracy without diffing as signal values change.

The Signals API consists of these functions:

- `$` to create signals.
- `effect` to run side effects when tracked signals change.
- `get` to unwrap a possible signal value.
- `untracked` to unwrap a possible signal value without tracking it.


### Basic State API

The core tool for working with state is the `$` function (hence the name of the library). The `$` function serves two purposes.

First, if you call it with a plain value it returns a `Writable` signal. A `Writable` is a signal object that can be called like a function to retrieve the currently stored value, and it also has a `set` method that can be used to update the stored value.

```js
import { $ } from "@manyducks.co/dolla";

const $count = $(0);

// Call to get current value
$count(); // 0

// Set a new value
$count.set(1);
$count(); // 1

// Update the value with a mapping function
$count.set((current) => current + 1);
$count(); // 2
````

Dolla's naming convention is to prepend a `$` to signal names. This is because signals have special side effects to be aware of when they are called. An `effect` is one such _tracking context_. Any signals accessed within it will be tracked, causing the function to run again when a tracked signal receives a new value.

```js
import { $, effect } from "@manyducks.co/dolla";

const $count = $(0);

// An effect is a function that implicitly subscribes to all $signal calls within it.
// Whenever any of these signals receives a new value the effect function will run again.
const unsubscribe = effect(() => {
  console.log("count is now " + $count());
});
// prints: count is now 0

$count.set(1);
// prints: count is now 1
$count.set(2);
// prints: count is now 2

// Effects can be cancelled by calling their unsubscribe function.
// This will unsubscribe the effect from all signal updates and it will not run again.
unsubscribe();

$count.set(3);
// does not print
````

Another tracking context, and another use for the `$` function, is to create derived signals. If you pass a function to `$`, any signals called within that function are tracked and the resulting signal will be recomputed only when those signals receive new values.

```js
import { $ } from "@manyducks.co/dolla";

const $count = $(5);

// Passing a function creates a computed signal.
// The function is called if any tracked signals have changed since its value was last accessed.
// For subsequent calls, the previous value is cached.
const $doubled = $(() => $count() * 2);
$doubled(); // 10
$doubled(); // 10 (cached)

// Technically, any function that calls a signal is a signal itself.
const $doubled2 = () => $count() * 2;
// This is another way to do a computed signal, although this value will be recomputed every time it's called.
// Prefer wrapping your computed signals with `$()` if you are doing expensive calculations.
```

#### Example 2: Selecting a User

```js
import { $ } from "@manyducks.co/dolla";

const $users = $([
  { id: 1, name: "Audie" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cabel" },
]);
const $userId = $(1);

const selectedUser = $(() => $users().find((user) => user.id === $userId()));

$selectedUser(); // { id: 1, name: "Audie" }

$userId(3);

$selectedUser(); // { id: 3, name: "Cabel" }
```

That was a more realistic example you might actually use in real life. Here we are selecting a user from a list based on its `id` field. This is kind of similar to a `JOIN` operation in a SQL database. I use this kind of pattern constantly in my apps.

The strength of setting up a join like this is that the `$users` array can be updated (by API call, websockets, etc.) and your `$selectedUser` will always be pointing to the latest version of the user data.

#### Example 3: Narrowing Complex Data

```jsx
import { $ } from "@manyducks.co/dolla";

const $user = $({ id: 1, name: "Audie" });
const $name = $(() => user().name);

$name(); // "Audie"

// In a view:
<span class="user-name">{$name}</span>;
```

Another common pattern. In a real app, most data is stored as arrays of objects. But what you need in order to slot it into a view is just a string. In the example above we've selected the user's name and slotted it into a `span`. If the `$user` value ever changes, the name will stay in sync.

### Converting to and from Signals

```js
import { $, get } from "@manyducks.co/dolla";

const $count = $(512);

// Unwrap the value of count. Returns 512.
const value = get($count);
// Passing a non-state value will simply return it.
const name = get("World");

// If you need to convert a static piece of data into a Signal you can simply wrap it in a getter function.
const value = () => "Hello";
```

### In Views

```jsx
import { $ } from "@manyducks.co/dolla";

function UserNameView(props, ctx) {
  const $name = $(() => props.$user().name);

  // Passing an object to `class` results in keys with a truthy value being applied as classes.
  // Those with falsy values will be ignored.
  // Signals can be given as values and they will be tracked.
  return (
    <span
      class={{
        "user-name": true,
        "is-selected": props.$selected
      }}>
      {$name}
    </span>
  );
})

// In parent view:

const $selected = $(false);
const $user = $({ id: 1, name: "Audie" });

<UserNameView $selected={$selected} $user={$user} />

// Changing signal values out here will now update the UserNameView internals.
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
