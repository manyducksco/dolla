# Dolla Hooks: The Cheat Sheet

Aight, so here's the deal with all the hooks in Dolla. Hooks are basically functions that let you tap into Dolla's brain—its reactive system and all that lifecycle stuff—from any of your components.

## Lifecycle Hooks

These hooks let you run code when your component is born, when it dies, and all the moments in between.

### `useMount(callback)`

Runs your code right after the component shows up on the page. If your function returns _another_ function, Dolla will automatically run that right after the component gets yeeted off the page. Perfect for cleanup\!

**Signature:**

```ts
function useMount(callback: () => void | (() => void)): void;
```

**Example:**

```tsx
import { useMount, useSignal } from "@manyducks.co/dolla";

function IntervalTimer() {
  const [$seconds, setSeconds] = useSignal(0);

  useMount(() => {
    // Start a timer when the component shows up
    const intervalId = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);

    // Return a function to clean up the mess. This runs on unmount.
    return () => {
      console.log("k, bye interval");
      clearInterval(intervalId);
    };
  });

  return <p>Seconds on page: {$seconds}</p>;
}
```

### `useUnmount(callback)`

Runs your code right after the component is removed. Great for any last-minute cleanup.

**Signature:**

```ts
function useUnmount(callback: () => void): void;
```

**Example:**

```tsx
import { useUnmount } from "@manyducks.co/dolla";

function AnalyticsTracker({ eventName }) {
  useUnmount(() => {
    // Tell your analytics that the user bounced
    fireAnalyticsEvent(`user_left_${eventName}_view`);
  });

  return <div>...</div>;
}
```

## State Hooks

These are the main tools for making your components interactive and smart.

### `useSignal(initialValue?)`

The main way to make reactive state in Dolla. It gives you back a `[getter, setter]` pair.

**Signature:**

```ts
function useSignal<T>(value?: T, options?: SignalOptions<T>): [Signal<T>, Setter<T>];
```

**Example:**

```tsx
import { useSignal } from "@manyducks.co/dolla";

function TextInput() {
  const [$text, setText] = useSignal("");
  const handleInput = (e) => setText(e.target.value);

  return (
    <div>
      <input type="text" value={$text} onInput={handleInput} />
      <p>You typed: {$text}</p>
    </div>
  );
}
```

### `useMemo(compute, deps?)`

Makes a new signal that's calculated from other signals. It's smart and only re-calculates when one of the signals it depends on changes.

**Signature:**

```ts
function useMemo<T>(compute: () => T, deps?: Signal<any>[]): Signal<T>;
```

**Example:**

```tsx
import { useSignal, useMemo } from "@manyducks.co/dolla";

function ShoppingCart() {
  const [$price, setPrice] = useSignal(100);
  const [$quantity, setQuantity] = useSignal(2);

  // This signal will always be the right total. No math for you.
  const $total = useMemo(() => $price() * $quantity());

  return (
    <div>
      <p>Price: {$price}</p>
      <p>Quantity: {$quantity}</p>
      <hr />
      <p>Total: {$total}</p>
    </div>
  );
}
```

### `useReducer(reducer, initialState)`

For when your state gets complicated and you wanna feel like a pro. It's just like the one in React.

**Signature:**

```ts
type Reducer<State, Action> = (state: State, action: Action) => State;
type Dispatcher<Action> = (action: Action) => void;

function useReducer<State, Action>(
  reducer: Reducer<State, Action>,
  initialState: State,
): [Signal<State>, Dispatcher<Action>];
```

**Example:**

```tsx
import { useReducer } from "@manyducks.co/dolla";

const counterReducer = (state, action) => {
  switch (action.type) {
    case "INCREMENT":
      return { ...state, count: state.count + 1 };
    case "DECREMENT":
      return { ...state, count: state.count - 1 };
    default:
      return state;
  }
};

function ReducerCounter() {
  const [$state, dispatch] = useReducer(counterReducer, { count: 0 });

  return (
    <>
      <p>Count: {() => $state().count}</p>
      <button onClick={() => dispatch({ type: "INCREMENT" })}>+</button>
      <button onClick={() => dispatch({ type: "DECREMENT" })}>-</button>
    </>
  );
}
```

### `useRef(initialValue?)`

Gives you a little box to hold onto something. Super useful for grabbing HTML elements. You can use `.current` or just call it like a function to get the value.

**Signature:**

```ts
function useRef<T>(initialValue?: T): HybridRef<T>;
```

**Example:**

```tsx
import { useRef, useMount } from "@manyducks.co/dolla";

function FocusOnMount() {
  const inputEl = useRef();

  useMount(() => {
    // get the element from .current
    if (inputEl.current) {
      inputEl.current.focus();
    }
    // you can also just call it like a function, lol
    console.log(inputEl());
  });

  return <input ref={inputEl} placeholder="i'm gonna be focused" />;
}
```

## Effect Hooks

These are for doing "side effects" - stuff that isn't just rendering, like fetching data or messing with the DOM directly.

### `useEffect(callback, deps?)`

The go-to hook for side effects. Your code runs after the component shows up, and then again whenever the signals it uses change. It's automatic, but you can give it a `deps` array if you wanna be extra and control it yourself.

**Signature:**

```ts
function useEffect(fn: () => void, deps?: Signal<any>[]): void;
```

**Example:**

```tsx
import { useEffect, useSignal } from "@manyducks.co/dolla";
import { http } from "@manyducks.co/dolla/http";

function UserData({ $userId }) {
  const [$user, setUser] = useSignal(null);

  // This effect will re-run whenever the $userId prop changes.
  useEffect(() => {
    const userId = $userId();
    http.get(`/api/users/${userId}`).then((res) => {
      setUser(res.body);
    });
  });

  return (
    <Show when={$user}>
      <p>User: {() => $user().name}</p>
    </Show>
  );
}
```

## Context Hooks

These are the hooks you use to mess with the context system. Think of it like a way to pass stuff down to your components without having to prop drill, which is a total vibe killer.

### `useContext(name?)`

This just grabs the `Context` object for whatever component you're in. The context has useful stuff like loggers and is how stores get passed around.

**Signature:**

```ts
function useContext(name?: MaybeSignal<string>): Context;
```

**Parameters:**

- `name` (optional): A string or signal you can pass in to give your component a custom name for logging. Makes debugging less of a headache.

**Example:**

```tsx
import { useContext } from "@manyducks.co/dolla";

function UserProfile() {
  // Grab the context and give it a cooler name
  const context = useContext("UserProfilePage");

  useMount(() => {
    // The log will now say "[UserProfilePage]". Noice.
    context.log("Component just dropped.");
  });

  return <div>...</div>;
}
```

### `useStore(Store)`

This hook looks up the component tree and finds the closest `Store` that a parent component hooked you up with.

**Signature:**

```ts
function useStore<T>(store: Store<any, T>): T;
```

**Parameters:**

- `store`: Just tell it which Store you're looking for.

**Example:**

```tsx
// Pretend some parent component already provided the SessionStore
import { useStore } from "@manyducks.co/dolla";
import { SessionStore } from "./stores/SessionStore.js";

function Navbar() {
  const session = useStore(SessionStore);

  return (
    <nav>
      <Show when={session.$isLoggedIn}>
        <p>Yo, {() => session.$user().name}!</p>
      </Show>
    </nav>
  );
}
```

### `useStoreProvider(Store, options?)`

This is how you make a `Store` available to a component and all its kids. You create it here, and then any component inside can just use `useStore` to grab it.

**Signature:**

```ts
function useStoreProvider<T, O>(store: Store<O, T>, options?: O): T;
```

**Parameters:**

- `store`: The Store you wanna provide.
- `options` (optional): Any options you need to pass to the Store when it's made.

**Example:**

```tsx
import { useStoreProvider } from "@manyducks.co/dolla";
import { ThemeStore } from "./stores/ThemeStore.js";
import { AppContent } from "./AppContent.js";

function App() {
  // Provide the ThemeStore to the whole app.
  // Any child can now get it with useStore(ThemeStore).
  useStoreProvider(ThemeStore, { defaultTheme: "dark" });

  return <AppContent />;
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
