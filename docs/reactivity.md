# Reactivity

Dolla's reactivity system is built on signals — lightweight, synchronous, dependency-tracked reactive values.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Atoms

The fundamental building block. `createAtom` returns a tuple of `[getter, setter]`.

```js
const [count, setCount] = createAtom(0);

count(); // get the value → 0
setCount(5); // set the value
setCount((c) => c + 1); // transform via function
```

Pass an existing getter to create a "settable" computed value — useful for input fields that may hold a temporary value until committed:

```js
const [getValue, setValue] = createAtom("");
const [input, setInput] = createAtom(getValue);

setInput("temp"); // input() → "temp", value() → ""
setValue("saved"); // both return "saved"
```

## Derived state with `compose`

Derive a value from other signals. Automatically tracks dependencies and caches until they change.

```js
const doubled = compose(() => count() * 2);
doubled(); // → 10 (if count is 5)

setCount(25);
doubled(); // → 50 (recomputed)
```

`compose` returns a getter. It's lazy — it only recomputes when read and a dependency has changed.

## Effects

Effects are covered in [Effects](./effects.md). See [When updates run](./concepts.md#when-updates-run) for how effect timing differs from DOM update timing.

## Reading without tracking

Use `peek` to read a getter without registering it as a dependency:

```js
compose(() => {
  return a() + peek(b); // changes to `b` won't trigger recomputation
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

## `unwrap`

Unwraps a `MaybeGetter<T>` into a plain value. Tracks if the value is a getter. Use `peek` (above) to read without tracking.

```js
unwrap(42); // 42
unwrap(count); // calls count() and tracks it
```

## Subscribing to changes

```js
const unsub = subscribe(count, (value) => {
  console.log("count changed to", value);
});
```

## `createSetter`

Create a custom setter for an existing getter:

```js
const [count, _setCount] = createAtom(0);

// Create a setter that can accept and parse a string.
const setCount = createSetter(count, (next: number | string) => {
  const parsed = Number(next);
  if (!isNaN(parsed)) {
    _setCount(parsed);
  }
});

// Setters created this way can take a plain value or an update function.
setCount(1); // count() == 1
setCount("2"); // count() == 2
setCount((current) => String(current + 1)); // count() == 3
```
