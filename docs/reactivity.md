# Reactivity

Dolla's reactivity system is built on signals — lightweight, synchronous, dependency-tracked reactive values.

## Atoms

The fundamental building block. `createAtom` returns a tuple of `[getter, setter]`.

```js
const [count, setCount] = createAtom(0);

count();               // get the value → 0
setCount(5);            // set the value
setCount((c) => c + 1); // transform via function
```

Pass an existing getter to create a "settable" computed value — useful for input fields that may hold a temporary value until committed:

```js
const [getValue, setValue] = createAtom("");
const [input, setInput] = createAtom(getValue);

setInput("temp");  // input() → "temp", value() → ""
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

## Effects with `createEffect`

Effects run side-effect code immediately and re-run whenever their tracked dependencies change.

```js
const stop = createEffect(() => {
  console.log("count is now", count());
  // may return a cleanup function
  return () => console.log("cleanup");
});

stop(); // stop the effect
```

`createEffect` has two overloads:

| Signature | Tracking |
|---|---|
| `createEffect(fn)` | Auto-tracking — tracks any getter read in `fn` |
| `createEffect(fn, deps)` | Deps array — `fn` receives unwrapped values from `deps`, re-runs only when those change |

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
unwrap(42);     // 42
unwrap(count);  // calls count() and tracks it
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
const setCount = createSetter(count, (next) => {
  if (next >= 0) return next;
  return 0;
});
```
