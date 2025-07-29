# Hooks

Dolla implements a React-style hooks API for use in Views, Stores and Mixins. Internally these hooks are still using signals, and view functions still only run once, but this API may be more fun and enjoyable for those familiar with React.

```js
import { useSignal, useEffect, useLogger } from "@manyducks.co/dolla";

export function CounterView() {
  const [$count, setCount] = useSignal(0);

  useEffect(() => {
    // Effect is triggered each time count changes; calling its getter tracks it.
    logger.info(`Count is now ${$count()}`);
  });

  return (
    <div>
      Count: {$count}
      <button onClick={() => setCount((n) => n + 1)}>+1</button>
      <button onClick={() => setCount((n) => n - 1)}>-1</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

```js
import { useReducer } from "@manyducks.co/dolla";

export function CounterView() {
  const countReducer = (state, action) => {
    switch (action) {
      case "increment":
        return state + 1;
      case "decrement":
        return state - 1;
      case "reset":
        return 0;
      default:
        throw new Error("Invalid action");
    }
  };
  const [count, dispatch] = useReducer(countReducer, 0);

  return (
    <div>
      Count: {count}
      <button onClick={() => dispatch("increment")}>+1</button>
      <button onClick={() => dispatch("decrement")}>-1</button>
      <button onClick={() => dispatch("reset")}>Reset</button>
    </div>
  );
}
```

## All Hooks

### `useSignal`

Creates a new signal and returns a getter and setter pair. Signals are functions that return the current value when called. If they are called within a tracking scope (such as a useMemo or useEffect function) they will _signal_ to that scope that they need to re-run when a new value is set.

```js
const [message, setMessage] = useSignal("Hello World");
message(); // "Hello World"
setValue("different value");
setValue((current) => current.toUpperCase());
```

### `useMemo`

Basic usage.

```js
const [count, setCount] = useSignal(5);

// Signals called within the body of the `useMemo` callback will be tracked.
// This means `doubled` will re-run and update its value when and only when its tracked dependencies do.
const doubled = useMemo(() => count() * 2);

// `useMemo` can also track other memoized values. You can nest derived values as deeply as you want.
const quadrupled = useMemo(() => doubled() * 2);
```

#### Explicit Dependencies

```js
const [first, setFirst] = useSignal(10);
const [second, setSecond] = useSignal(20);

// You can alternatively pass an array of dependencies. When you do this your callback will be re-run whenever
// any of the provided dependencies change, regardless of what dependencies you actually call inside the callback;
const added = useMemo(() => first() + second(), [second]);

added(); // 30
setFirst(11);
added(); // 30; did not update because only second() is tracked as a dependency.
setSecond(21);
added(); // 32; now it updates because second() received a new value.

// Note: receives the value it returned last as the first argument.
// Node: can pass a deps array to re-run when deps change regardless of what's called inside the memo function.
```

### `useEffect`

> TODO
>
> 1. Autotracked deps
> 2. Explicitly tracked deps

### `useRef`

Create a new ref. Refs are useful for getting references to DOM nodes rendered by Dolla. View functions are only called once, so refs in Dolla are not as broadly applicable for storing other types of data as they are in React.

```js
function ExampleView() {
  const element = useRef();

  useMount(() => {
    console.log("The element!", element.current);
  });

  return <div ref={element}>I am a div.</div>;
}
```

### `useContext`

Returns a reference to the `Context` object for the current component, be it a View, Store or Mixin.

```js
// `useContext` returns the currently active Context object for the View, Store or Mixin it's called in.
function ExampleView() {
  const context = useContext();
  context.log("Hello!");
  context.addStore(ExampleStore);

  // ...
}
```

### `useStore`

Access an instance of a provided Store. Equivalent to `context.getStore(Store)`.

```jsx
// Define a store...
function CounterStore() {
  const [value, setValue] = useSignal(0);

  const increment = () => setValue((n) => n + 1);
  const decrement = () => setValue((n) => n - 1);

  return {
    value,
    increment,
    decrement,
  };
}

// Register the store at some point in the view tree.
function ParentView() {
  const context = useContext();
  context.addStore(CounterStore);

  return <ChildView />;
}

// Then access it with the hook.
function ChildView() {
  const counter = useStore(CounterStore);

  counter.value(); // 0
  counter.increment();
  counter.value(); // 1

  return <span>{counter.value}</span>;
}
```

### `useMount`

Register a callback to run when the context is mounted. If the callback returns a function, that function is called when the context is unmounted.

```js
function ExampleView() {
  useMount(() => {
    console.log("View is now mounted.")

    return () => {
      console.log("View is now unmounted.);
    }
  });

  // ...
}
```

### `useUnmount`

Register a callback to run when the context is unmounted.

```js
function ExampleView() {
  useUnmount(() => {
    console.log("View is now unmounted.");
  });

  // ...
}
```
