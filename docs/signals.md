## ⚡ Reactive Updates with `Signals`

Dolla sets out to solve the challenge of keeping your UI in sync with your data. All apps have state that changes at runtime, and your UI must update itself to stay in sync with that state as it changes. JavaScript frameworks all have their own ways of doing this, but there are two main ones; virtual DOM and signals. Dolla follows the Signals philosophy.

[React](https://react.dev) and similar frameworks make use of a [virtual DOM](https://svelte.dev/blog/virtual-dom-is-pure-overhead), in which every state change causes a "diff" of the real DOM nodes on the page against a lightweight representation of what those nodes _should_ look like, followed by a "patch" where the minimal updates are performed to bring the DOM in line with the ideal virtual DOM.

[Solid](https://www.solidjs.com) and similar frameworks make use of [signals](https://dev.to/this-is-learning/the-evolution-of-signals-in-javascript-8ob), which are containers for data that will change over time. Signal values are accessed through special getter functions that can be called inside of a "scope" to track their values. When the value of a tracked signal changes, any computations that happened in scopes that depend on those signals are re-run. In an app like this, all of your DOM updates are performed with pinpoint accuracy without diffing as signal values change.

The Signals API in Dolla has just four functions:

- `$` to create a new Source or derived Signal.
- `get` to unwrap a possible Signal value.
- `peek` to unwrap a possible Signal value without tracking it.
- `effect` to run side effects when tracked signals change.

### Basic State API

```js
import { $ } from "@manyducks.co/dolla";

const count = $(72);

// Get the current value.
count(): // 72

// Set a new value.
count(300);

// The State now reflects the latest value.
count(); // 300

// Data can also be updated by passing an update function.
// This function takes the current state and returns the next.
count((value) => value + 1);
count(); // 301
```

### Deriving States from other States

#### Example 1: Doubled

```js
import { $ } from "@manyducks.co/dolla";

// Passing a value to $() results in a Source...
const count = $(1);

// ...while passing a function results in a Signal with a derived value.
const doubled = $(() => count() * 2);

count(10);
doubled(); // 20
```

##### A note on derived signals.

Because signals are simply functions that return a value, you can also derive state by simply defining a function that returns a value. Any `Source` called in this function will therefore be tracked when this function is called in a tracked scope.

The difference is that the value of the plain function is computed again each and every time that function is called. Wrapping it with `$()` will result in the computed value being cached until one of its dependencies changes. If you are coming from React then you may want to think of this like `useMemo`.

```js
// Plain getter: OK
const plainCount = () => count() * 2;

// Signal: OK
const cachedCount = $(() => count() * 2);
```

Using plain getters to derive values is perfectly fine. It may be a waste to cache a very simple getter, but if the value is accessed frequently or involves expensive computations then you can get better performance by wrapping it in a Signal.

#### Example 2: Selecting a User

```js
import { $ } from "@manyducks.co/dolla";

const users = $([
  { id: 1, name: "Audie" },
  { id: 2, name: "Bob" },
  { id: 3, name: "Cabel" },
]);
const userId = $(1);

const selectedUser = $(() => users().find((user) => user.id === userId()));

selectedUser(); // { id: 1, name: "Audie" }

userId(3);

selectedUser(); // { id: 3, name: "Cabel" }
```

That was a more realistic example you might actually use in real life. Here we are selecting a user from a list based on its `id` field. This is kind of similar to a `JOIN` operation in a SQL database. I use this kind of pattern constantly in my apps.

The strength of setting up a join like this is that the `$users` array can be updated (by API call, websockets, etc.) and your `$selectedUser` will always be pointing to the latest version of the user data.

#### Example 3: Narrowing Complex Data

```jsx
import { $ } from "@manyducks.co/dolla";

const user = $({ id: 1, name: "Audie" });
const name = $(() => user().name);

name(); // "Audie"

// In a view:
<span class="user-name">{name}</span>;
```

Another common pattern. In a real app, most data is stored as arrays of objects. But what you need in order to slot it into a view is just a string. In the example above we've selected the user's name and slotted it into a `span`. If the `$user` value ever changes, the name will stay in sync.

### Converting to and from Signals

```js
import { $, get } from "@manyducks.co/dolla";

const count = state(512);

// Unwrap the value of count. Returns 512.
const value = get(count);
// Passing a non-state value will simply return it.
const name = get("World");

// If you need to convert a static piece of data into a Signal you can simply wrap it in a getter function.
const value = () => "Hello";
```

### In Views

```jsx
import { $ } from "@manyducks.co/dolla";

function UserNameView(props, ctx) {
  const name = $(() => props.user().name);

  // Passing an object to `class` results in keys with a truthy value being applied as classes.
  // Those with falsy values will be ignored.
  // Signals can be given as values and they will be tracked.
  return (
    <span
      class={{
        "user-name": true,
        "is-selected": props.selected
      }}>
      {name}
    </span>
  );
})

// In parent view:

const selected = $(false);
const user = $({ id: 1, name: "Audie" });

<UserNameView selected={selected} user={user} />

// Changing signal values out here will now update the UserNameView internals.
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
