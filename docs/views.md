# Dolla Views: The Main Character

Aight, let's talk about the main event, the star of the show: **Views**.

Views are the components you're gonna be writing 99% of the time. They're the bread and butter of your Dolla app. Their whole job is to take some data and spit out the HTML that shows up on the screen. If you've ever written a React component, you're already basically a pro at this.

## So, what even IS a View?

It's dead simple: **a View is just a JavaScript function that returns JSX.** That's it. No classes, no weird `render()` methods, just a function.

### The Simplest View

Here's a View that literally just says hello. It doesn't get any easier than this.

```jsx
// This is a totally valid View component!
function HelloWorld() {
  return <h1>What up, world!</h1>;
}
```

You can then use this component in another component just like it's a regular HTML tag:

```jsx
function App() {
  return (
    <div>
      <HelloWorld />
    </div>
  );
}
```

## Props: Making Your Views Reusable

A component that does the same thing every time is kinda boring. You're gonna want to pass data into your Views to make them dynamic. We do this with **props** (short for properties).

Props are passed to your View function as a single object.

```jsx
// This View can now greet anyone!
function Greeting(props) {
  // `props` is an object: { name: "Alice" }
  return <h1>Yo, {props.name}!</h1>;
}

function App() {
  return <Greeting name="Alice" />;
}
```

### Passing Dynamic Props (aka The Cool Part)

You can pass anything as a prop: strings, numbers, arrays, objects, even other components. But the real magic is passing **signals**.

If you're passing the whole signal, you can just pass it directly. It'll stay reactive.

```jsx
function App() {
  const [$userName, setUserName] = useSignal("Guest");
  setTimeout(() => setUserName("Bob"), 2000);

  // Just pass the signal directly! It stays reactive.
  return <Greeting name={$userName} />;
}
```

But what if you need to pass a _piece_ of a signal, like a property from an object? If you just write `name={$currentUser().name}`, you're only getting the value _right now_, and it won't update later. That's a bummer.

**Super Important Rule:** To keep it reactive when you're _accessing or deriving a value_ from a signal, you gotta wrap it in an arrow function `() => ...`. This tells Dolla to re-run that little function whenever the original signal changes.

```jsx
function App() {
  const [$currentUser, setCurrentUser] = useSignal({ name: "Guest" });
  setTimeout(() => setCurrentUser({ name: "Alice" }), 2000);

  return (
    <div>
      {/* This LOSES reactivity because we're calling the function now */}
      <Greeting name={$currentUser().name} />

      {/* This STAYS reactive because we wrapped it in another function! */}
      <Greeting name={() => $currentUser().name} />
    </div>
  );
}
```

### The Special `children` Prop

Sometimes you wanna wrap one component inside another. The inner component gets passed to the outer one in a special prop called `children`.

```jsx
function Card(props) {
  // This component is a generic "card" wrapper
  return <div class="card">{props.children}</div>;
}

function App() {
  return (
    <Card>
      {/* This stuff is the `children` prop for the Card */}
      <h2>This is a card</h2>
      <p>It can have anything inside it!</p>
    </Card>
  );
}
```

## Superpowered JSX: Props, Events, and More

When your View returns JSX, you can put some special props on the HTML elements that have superpowers. These are handled by Dolla directly and aren't passed down into child components.

### `ref`: Grabbing the HTML Element

Sometimes you need to get your hands dirty and talk to the actual HTML element. The `ref` prop is your escape hatch for that.

```jsx
import { useRef, useMount } from "@manyducks.co/dolla";

function AutoFocusInput() {
  const inputEl = useRef();

  useMount(() => {
    // We can now talk to the real <input> element!
    inputEl.current.focus();
  });

  // Just pass the ref to the element
  return <input ref={inputEl} type="text" />;
}
```

### `mixin`: Adding Superpowers

We have [a whole doc page on mixins](./mixins.md), but just know you apply them to an element using the `mixin` prop.

```jsx
import { autofocus } from "./mixins/autofocus.js";

function MyForm() {
  return <input mixin={autofocus()} />;
}
```

### `class`: The Class Name GOAT

Managing CSS classes can be a pain. Dolla's `class` prop makes it a breeze. You can pass it an array of strings, or even better, an object where the keys are class names and the values are signals that toggle them. This is fully reactive\!

```jsx
import { useSignal } from "@manyducks.co/dolla";

function InteractiveBox() {
  const [$isActive, setActive] = useSignal(false);

  return (
    <div
      class={{
        box: true, // This class is always on
        active: $isActive, // This class toggles when $isActive changes
      }}
      onClick={() => setActive((current) => !current)}
    >
      Click me to toggle the 'active' class.
    </div>
  );
}
```

### Handling Events

Dolla gives you a few ways to listen for events.

- **CamelCase:** Just like in React, you can use `onClick`, `onInput`, `onMouseEnter`, etc. This is the main way you'll do it.
- **`on:` prefix:** You can also use `on:click`, `on:input`, etc. This is useful for custom events that aren't on Dolla's known event list.
- **`onClickOutside`:** This is a special one\! It's a synthetic event that fires when you click anywhere _outside_ the element. It's perfect for closing modals and dropdowns.

<!-- end list -->

```jsx
function EventExample() {
  const handleClick = () => console.log("Clicked!");
  const handleCustom = () => console.log("Custom event fired!");
  const handleOutside = () => console.log("Clicked outside!");

  return (
    <div onClick={handleClick} on:my-custom-event={handleCustom} onClickOutside={handleOutside}>
      Click me!
    </div>
  );
}
```

### `attr:` and `prop:` Prefixes

Sometimes, HTML is weird. There's a difference between an element's _attribute_ (the thing you write in the HTML) and its _property_ (the thing on the DOM object in JavaScript). Usually, Dolla figures it out for you, but if you need to be specific, you can use prefixes.

- `attr:my-attribute={...}`: This will _always_ set the HTML attribute.
- `prop:myProperty={...}`: This will _always_ set the DOM property.

<!-- end list -->

```jsx
// This sets the `aria-label` attribute, which is what you want for accessibility.
<button attr:aria-label="Close">X</button>

// This sets the `.value` property of the input, which is what you want for controlled inputs.
<input prop:value={$mySignal} />
```

### Other Cool Prop Tricks

- **`style`:** You can pass a style object, and it works just like you'd expect. You can even pass signals as values, and the styles will update automatically\!
- **`dataset`:** Pass an object to `dataset` to set a bunch of `data-*` attributes all at once.
- **SVG Support:** Dolla automatically knows when you're making an `<svg>` element and will handle creating it and its children correctly. No extra work needed.

## Built-in Views: Control Flow & Utilities

Dolla also gives you a few built-in views to make common UI patterns easier. They're just special components that you can use alongside your own.

### `<Show>`: The "Now You Can See Me, Now You Can't" Component

The `<Show>` component is your new bestie for conditional rendering. It's a super clean way to show or hide stuff based on whether something is true or false. Way better than a messy ternary operator in your JSX, tbh.

#### The Props

- **`when`**: The main one. If the value you pass it is "truthy" (not `false`, `0`, `null`, or `undefined`), the children will show up.
- **`unless`**: The opposite of `when`. If the value is "falsy," the children will show.
- **`children`**: The stuff you actually wanna show or hide.
- **`fallback`**: What to show if the condition isn't met. Kinda like an `else` statement.

#### Example

```jsx
import { Show, useSignal, useMemo } from "@manyducks.co/dolla";

function UserProfile() {
  const [$user, setUser] = useSignal(null);
  const $isLoggedIn = useMemo(() => $user() !== null);

  // Pretend we log in after 2 seconds
  setTimeout(() => setUser({ name: "Alice" }), 2000);

  return (
    <div class="user-widget">
      <Show when={$isLoggedIn} fallback={<p>Loading profile...</p>}>
        <h2>Welcome back, {() => $user().name}!</h2>
      </Show>
    </div>
  );
}
```

### `<For>`: The Looping GOAT

When you have an array of stuff and you need to render a list, `<For>` is what you want. It's super optimized, so if you add, remove, or reorder items in your array, it only touches the exact HTML elements that need to change. It's way more efficient than just using `.map()`.

#### The Props

- **`each`**: The signal that holds your array of items.
- **`key`** (optional but recommended): A function that returns a unique ID for each item. This helps Dolla keep track of things and makes updates way faster, especially if your list can be reordered. If you don't provide one, it just uses the item itself as the key.
- **`children`**: A function that gets called for every item in the array. It's your job to return the JSX for that item.

The `children` function gets two arguments, and they're both **signals**: `($item, $index) => { ... }`. Because they're signals, Dolla can do some really smart optimizations instead of just recreating everything when the list changes.

#### Example

```jsx
import { For, useSignal } from "@manyducks.co/dolla";

function UserList() {
  const [$users, setUsers] = useSignal([
    { id: 1, name: "Alice" },
    { id: 2, name: "Bob" },
  ]);

  const addUser = () => {
    const id = Math.random();
    setUsers((current) => [...current, { id, name: "New User" }]);
  };

  return (
    <div>
      <button onClick={addUser}>Add User</button>
      <ul>
        <For each={$users} key={(user) => user.id}>
          {($item, $index) => (
            <li>
              User #{$index}: {() => $item().name}
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}
```

### `<Portal>`: The Teleporter

A `<Portal>` takes its children and renders them somewhere else on the page, outside of your main app container. This is clutch for stuff like modals, pop-up notifications, or tooltips that need to break out of their parent's styling.

And here's the best part: even though the HTML gets yeeted to another part of the DOM, the Portal is still your component's child in the "component tree". That means it can still access all the same context and stores as if it were rendered right there. It's a total game-changer for modals that need to talk to your app's state.

#### The Props

- **`into`**: Where you wanna yeet the content. This can be a DOM element (like `document.body`) or a CSS selector string (like `'#modal-root'`).
- **`children`**: The stuff you wanna teleport.

#### Example

```jsx
import { Portal, Show, useSignal } from "@manyducks.co/dolla";

function ModalExample() {
  const [$isOpen, setOpen] = useSignal(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Modal</button>
      <Show when={$isOpen}>
        <Portal into="#modal-root">
          <div class="modal-content">
            <h2>This is a modal!</h2>
            <p>It's living in a different part of the DOM.</p>
            <button onClick={() => setOpen(false)}>Close</button>
          </div>
        </Portal>
      </Show>
    </>
  );
}
```

### `<Fragment>`: The Invisible Wrapper

You're almost never gonna type `<Fragment>` yourself. It's the thing that lets you return a bunch of elements from a component without having to wrap them in a `<div>`. When you type `<>...</>`, you're actually using a Fragment. It's the GOAT for keeping your HTML clean.

## To Sum It Up

- **Views** are just functions that return JSX.
- You pass data to them using **props**.
- To keep data reactive, pass signals directly (`prop={$mySignal}`), or wrap derived values in a function (`prop={() => $mySignal().value}`).
- Dolla gives you special props like `ref`, `mixin`, and `class` for the DOM nodes inside your Views, plus a bunch of other cool tricks.
- You also get handy built-in Views like `<Show>`, `<For>`, and `<Portal>` to make your life easier.
- If you need to manage state that's shared between a bunch of views, that's a job for a **Store**.
- If you just need to add behavior to a single HTML element, that's a job for a **Mixin**.
- For everything else—the actual structure and UI of your app—you'll be writing **Views**.

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
