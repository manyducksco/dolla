## ⚡ Reactive Updates with `State`

Dolla sets out to solve the challenge of keeping your UI in sync with your data. All apps have state that changes at runtime, and as those values change your UI must update itself to stay in sync with that state. JavaScript frameworks all have their own ways of meeting this challenge, but there are two main ones; virtual DOM and signals.

[React](https://react.dev) and similar frameworks make use of a [virtual DOM](https://svelte.dev/blog/virtual-dom-is-pure-overhead), in which every state change causes a "diff" of the real DOM nodes on the page against a lightweight representation of what those nodes _should_ look like, followed by a "patch" where the minimal updates are performed to bring the DOM in line with the ideal virtual DOM.

[Solid](https://www.solidjs.com) and similar frameworks make use of [signals](https://dev.to/this-is-learning/the-evolution-of-signals-in-javascript-8ob), which are containers for data that will change over time. Signal values are accessed through special getter functions that can be called inside of a "scope" to track their values. When the value of a tracked signal changes, any computations that happened in scopes that depend on those signals are re-run. In an app like this, all of your DOM updates are performed with pinpoint accuracy without diffing as signal values change.

Dolla uses a concept of a `State`, which is a signal-like container for values that change over time. Where `State` differs from signals, however, is that there is no magical scope tracking going on behind the scenes. All States that depend on others do so explicity, so your code is easier to read and understand.

The `State` API has just four functions:

- `createState` to create a new state and a linked setter function.
- `derive` to create a new state whose value depends on one or more other states.
- `toState` to ensure that a value is a state object.
- `toValue` to ensure that a value is a plain value.

### Basic State API

```js
import { createState } from "@manyducks.co/dolla";

// Equivalent to React's `useState` or Solid's `createSignal`.
// A new read-only State and linked Setter are created.
const [$count, setCount] = createState(72);

// Get the current value.
$count.get(): // 72

// Set a new value.
setCount(300);

// The State now reflects the latest value.
$count.get(); // 300

// Data can also be updated by passing a function.
// This function takes the current state and returns a new one.
setCount((current) => current + 1);
$count.get(); // 301
```

### Deriving States from other States

#### Example 1: Doubled

```js
import { createState, derive } from "@manyducks.co/dolla";

const [$count, setCount] = createState(1);

const $doubled = derive([$count], (count) => count * 2);

setCount(10);
$doubled.get(); // 20
```

That was a typical toy example where we create a `$doubled` state that always contains the value of `$count`... doubled! This is the essential basic example of computed properties, as written in Dolla.

#### Example 2: Selecting a User

```js
import { createState, derive } from "@manyducks.co/dolla";

const [$users, setUsers] = createState([
  { id: 1, name: "Audie" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cabel" },
]);
const [$selectedUserId, setSelectedUserId] = createState(1);

const $selectedUser = derive([$users, $selectedUserId], (users, id) => {
  return users.find((user) => user.id === id);
});

$selectedUser.get(); // { id: 1, name: "Audie" }

setSelectedId(3);

$selectedUser.get(); // { id: 3, name: "Cabel" }
```

That was a more realistic example you might actually use in real life. Here we are selecting a user from a list based on its `id` field. This is kind of similar to a `JOIN` operation in a SQL database. I use this kind of pattern constantly in my apps.

The strength of setting up a join like this is that the `$users` array can be updated (by API call, websockets, etc.) and your `$selectedUser` will always be pointing to the latest version of the user data.

#### Example 3: Narrowing Complex Data

```jsx
import { createState, derive } from "@manyducks.co/dolla";

const [$user, setUser] = createState({ id: 1, name: "Audie" });

const $name = derive([$user], (user) => user.name);

$name.get(); // "Audie"

// In a view:
<span class="user-name">{$name}</span>;
```

Another common pattern. In a real app, most data is stored as arrays of objects. But what you need in order to slot it into a view is just a string. In the example above we've selected the user's name and slotted it into a `span`. If the `$user` value ever changes, the name will stay in sync.

### Converting to and from States

```js
import { createState, toState, toValue } from "@manyducks.co/dolla";

const [$count, setCount] = createState(512);

// Unwrap the value of $count. Returns 512.
const count = toValue($count);
// Passing a non-state value will simply return it.
const name = toValue("World");

// Wrap "Hello" into a State containing "Hello"
const $value = toState("Hello");
// Passing a state will simply return that same state.
const $number = toState($count);
```

### In Views

```jsx
import { derive } from "@manyducks.co/dolla";

function UserNameView(props, ctx) {
  const $name = derive([props.$user], (user) => user.name);

  return <span class={{ "user-name": true, "is-selected": props.$selected }}>{$name}</span>;
});
```

In the example above we've displayed the `name` field from a `$user` object inside of a span. We are also assigning an `is-selected` class dynamically based on whether the `$selected` prop contains a truthy or falsy value.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
