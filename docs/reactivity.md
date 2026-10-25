# Reactivity

Dolla's reactivity system is built on signals — lightweight, synchronous, dependency-tracked reactive values.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown. Name getters with a `get` prefix so it is obvious which half of an atom you are passing around.

## Atoms

The fundamental building block. `createAtom` returns a tuple of `[getter, setter]`.

```js
const [getCount, setCount] = createAtom(0);

getCount(); // get the value → 0
setCount(5); // set the value
setCount((count) => count + 1); // transform via function
```

Pass an existing getter to create a "settable" computed value — useful for input fields that may hold a temporary value until committed:

```js
const [getValue, setValue] = createAtom("");
const [getInput, setInput] = createAtom(getValue);

setInput("temp"); // getInput() → "temp", getValue() → ""
setValue("saved"); // both return "saved"
```

## Derived state with `compose`

Derive a value from other signals. Automatically tracks dependencies and caches until they change.

```js
const [getCount, setCount] = createAtom(5);

const getDoubled = compose(() => getCount() * 2);
getDoubled(); // → 10

setCount(25);
getDoubled(); // → 50 (recomputed)
```

`compose` returns a getter. It's lazy — it only recomputes when read and a dependency has changed. The callback may return a value or a getter; a returned getter is read with `get`, so nested getters are unwrapped and tracked.

## Using signals in JSX

Pass the getter, not the result:

```jsx
const [getCount, setCount] = createAtom(0);

<p>Count: {getCount}</p>;
<button onClick={() => setCount((count) => count + 1)}>+1</button>;
```

For a derived value, interpolate the composed getter:

```jsx
const getDoubled = compose(() => getCount() * 2);

<p>Doubled: {getDoubled}</p>;
```

For a property access, wrap it in a getter:

```jsx
<p>{() => getUser().name}</p>;
```

See [Values flow through getters](./concepts.md#values-flow-through-getters) for the full rule, including attributes, props, and logic.

## Effects

Inside a view or store, use [`onEffect(context, fn)`](./effects.md). It runs on mount and re-runs when tracked getters change. See [When updates run](./concepts.md#when-updates-run) for effect timing.

For effects outside the context tree, `createEffect(fn)` is an advanced fallback; see [Standalone effects](./advanced.md#standalone-effects).

## Reading without tracking

Use `peek` to read a getter without registering it as a dependency:

```js
compose(() => {
  return getA() + peek(getB); // changes to getB won't trigger recomputation
});
```

## Batching changes

Group multiple signal writes into a single update. Effects run once after the batch completes.

```js
batch(() => {
  setCount(5);
  setName("Alice");
});
```

## `get`

Returns the value of a `MaybeGetter<T>`. If the value is a getter, `get` reads it and tracks it; otherwise it returns the value unchanged. Use it when a prop or parameter accepts either form. For a value already typed `Getter<T>`, calling it directly is enough. Use `peek` (above) to read without tracking.

```js
get(42); // 42
get(getCount); // calls getCount() and tracks it
```

```jsx
function Greeting(props) {
  // `props.name` is typed as MaybeGetter<string>.
  const getInitial = compose(() => get(props.name).charAt(0));
  return <p>{getInitial}: {props.name}</p>;
}
```

`unwrap` is a deprecated alias for `get`. See [Props follow their declared types](./concepts.md#props-follow-their-declared-types) for how prop types determine what you should read.

## Subscribing to changes

If you need to react to changes in the value of a signal outside of a template/view context, you can use the `subscribe` helper:

```js
import { subscribe } from "@manyducks.co/dolla/internals";

const unsubscribe = subscribe(getCount, (value) => {
  console.log("count changed to", value);
});
```

`subscribe` runs the callback immediately with the current value, then again whenever the value changes. Call the returned function to stop.

## `createSetter`

Create a custom setter for an existing getter:

```js
const [getCount, setCountBase] = createAtom(0);

// Create a setter that can accept and parse a string.
const setCount = createSetter(getCount, (next) => {
  const parsed = Number(next);
  if (!Number.isNaN(parsed)) {
    setCountBase(parsed);
  }
});

// Setters created this way can take a plain value or an update function.
setCount(1); // getCount() == 1
setCount("2"); // getCount() == 2
setCount((current) => String(current + 1)); // getCount() == 3
```

## Next steps

- [Effects](./effects.md) — `onEffect`, auto-tracking, cleanup
- [Errors](./errors.md) — effect error reporting and `SignalError`
- [Templates](./templates.md) — interpolation and props
- [Components](./components.md) — views, stores, and control flow
- [Cheatsheet](./cheatsheet.md) — quick lookups
