# The Lowdown on Dolla Components

Aight, so in Dolla, your whole app is just a bunch of **components**. They're the lego bricks for your UI, your state, all that good stuff. Getting how they work is basically the key to winning at this whole framework thing.

Dolla's got three main types of components, and each one has its own lane:

1.  **Views**: For making your UI look pretty.
2.  **Stores**: For handling and sharing state so you don't lose your mind.
3.  **Mixins**: For giving your plain old HTML elements some extra rizz.

They're all connected by this thing called **context**, which is how they talk to each other and share stuff like stores. Let's get into it.

---

## Views: The Stuff You See

**Views** are the components you're gonna be making all the time. They're literally just JavaScript functions that spit out some JSX. If you've ever touched React, you'll feel right at home, fr.

### Making a View

It's just a function that gets a `props` object. That's it.

```jsx
import { useSignal } from "@manyducks.co/dolla";

// A super simple View
function Greeting(props) {
  return <h1>Yo, {props.name}!</h1>;
}

// A View with its own state and stuff
function Counter() {
  const [$count, setCount] = useSignal(0);
  const increment = () => setCount((c) => c + 1);

  return (
    <div>
      <p>Count: {$count}</p>
      <button onClick={increment}>+1</button>
    </div>
  );
}
```

### Passing Props

You send data into your Views with `props`. They look just like HTML attributes. This is how you make your components useful instead of just being static, boring things.

```jsx
function App() {
  return (
    <div>
      {/* Pass a normal string */}
      <Greeting name="Alice" />

      {/* To derive a signal and keep it reactive, wrap it in a function! */}
      <Greeting name={() => $currentUser().firstName} />
    </div>
  );
}
```

---

## Stores: Stop Prop Drilling Hell

**Stores** are Dolla's answer to state management. Got some state that like, ten different components need? Instead of passing props down a million levels (aka "prop drilling," the worst), you just use a Store.

### Making a Store

A Store is a function that makes and returns an object full of signals and functions. It's like a clean little API for a piece of your app's state.

```jsx
import { useSignal, useMemo } from "@manyducks.co/dolla";

function UserStore(options) {
  // `options` come from where you provide the store
  const [$user, setUser] = useSignal({ id: options.initialUserId, name: "Guest" });
  const $isGuest = useMemo(() => $user().id === null);

  const login = (userData) => {
    // A real login would probably fetch this data
    setUser(userData);
  };

  const logout = () => {
    setUser({ id: null, name: "Guest" });
  };

  // Send out the signals and functions for other components to use
  return { $user, $isGuest, login, logout };
}
```

### Using a Store

First, you "provide" the store in a parent component with `useStoreProvider`. Then, any kid component can grab it with `useStore`. Easy.

```jsx
import { useStoreProvider, useStore } from "@manyducks.co/dolla";

// 1. Provide the store up high
function App() {
  // Now the UserStore is available to App and everything inside it
  useStoreProvider(UserStore, { initialUserId: null });

  return <Navbar />;
}

// 2. Use it down low
function Navbar() {
  // Just ask for the UserStore instance
  const userStore = useStore(UserStore);

  return (
    <nav>
      <Show when={() => !userStore.$isGuest()}>
        <p>Welcome, {() => userStore.$user().name}!</p>
        <button onClick={userStore.logout}>Log Out</button>
      </Show>
      <Show when={() => userStore.$isGuest()}>
        <button onClick={() => userStore.login({ id: 1, name: "Alice" })}>Log In</button>
      </Show>
    </nav>
  );
}
```

---

## Mixins: Giving Your HTML Superpowers

**Mixins** are a sick feature for attaching reusable logic straight to your HTML elements. A mixin is a function that returns _another_ function, and that inner function gets the element it's attached to. Inside, you can use hooks to do whatever you want.

### Making a Mixin

Here's a mixin that makes an element's background change color when you hover over it.

```jsx
import { useMount } from "@manyducks.co/dolla";

function hoverHighlight(color = "yellow") {
  // The outer function lets you set it up
  return (element) => {
    // The inner function gets the element and can use hooks
    const originalColor = element.style.backgroundColor;

    const handleMouseEnter = () => {
      element.style.backgroundColor = color;
    };

    const handleMouseLeave = () => {
      element.style.backgroundColor = originalColor;
    };

    useMount(() => {
      element.addEventListener("mouseenter", handleMouseEnter);
      element.addEventListener("mouseleave", handleMouseLeave);

      // useMount lets you return a cleanup function. Dope.
      return () => {
        element.removeEventListener("mouseenter", handleMouseEnter);
        element.removeEventListener("mouseleave", handleMouseLeave);
      };
    });
  };
}
```

### Using a Mixin

You slap mixins onto elements with the `mixin` prop. You can use one, or go wild and use a whole array of 'em.

```jsx
function InteractiveList() {
  return (
    <ul>
      {/* Just call the outer function to apply it */}
      <li mixin={hoverHighlight()}>Hover me!</li>
      <li mixin={hoverHighlight("lightblue")}>Or me!</li>
      <li mixin={[hoverHighlight(), otherMixin()]}>I got two, lol</li>
    </ul>
  );
}
```

---

## The Component Lifecycle (aka Birth and Death)

Dolla components have a simple life: they get **mounted** (put on the page) and **unmounted** (yeeted off the page). You can run code at these times with lifecycle hooks.

### `useMount(callback)`

This hook runs your code right after your component shows up. It's the spot for setting up timers, listeners, whatever.

If you return a function from `useMount`, Dolla will automatically run it for you right after the component is unmounted. It's like a built-in maid service for your code.

### `useUnmount(callback)`

This hook runs your code right before the component is unmounted. Good for quick, one-off cleanup tasks.

```jsx
import { useMount, useUnmount, useSignal } from "@manyducks.co/dolla";

function RealtimeClock() {
  const [$time, setTime] = useSignal(new Date().toLocaleTimeString());

  // useMount is perfect for setup AND cleanup
  useMount(() => {
    console.log("Clock's here, starting the timer.");
    const timerId = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    // This cleanup function runs when the component is gone
    return () => {
      console.log("Clock's leaving, killing the timer.");
      clearInterval(timerId);
    };
  });

  // useUnmount for other random cleanup
  useUnmount(() => {
    console.log("The clock is officially off the page.");
  });

  return <p>The time is: {$time}</p>;
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
