# Ref

Refs are functions that serve as a getter and setter for a stored value. Calling a ref with no arguments will return its stored value, or throw an error if no value has yet been stored. Calling a ref with a single argument will store a new value.

This signature is very similar to that of a `Source` signal, with the differences being their error throwing behavior while empty and that refs are _not_ trackable in a signal context.

## Pattern #1: Referencing DOM nodes

The main pattern for refs is as a DOM node reference. Markup elements take a `ref` attribute to which they will pass their DOM node when they are mounted.

Once you have this reference you can manipulate the node outside the usual declarative template workflow.

```tsx
import { ref } from "@manyducks.co/dolla";

function ExampleView() {
  const element = ref<HTMLElement>();

  ctx.onMount(() => {
    element().innerText = "GOODBYE THERE";
  });

  return <div ref={element}>HELLO THERE</div>;
}
```

## Pattern #2: Controlling a child view from a parent view

Another useful pattern is to pass an API object from a child view to the parent, allowing the parent to call methods to control the child view in an imperative way.

```tsx
import { ref } from "@manyducks.co/dolla";

// First we'll define the view to be controlled.

interface CounterViewControls {
  increment(): void;
  decrement(): void;
  reset(): void;
}

interface CounterViewProps {
  controls: Ref<CounterViewControls>;
}

function CounterView({ controls }: CounterViewProps) {
  const $count = $(count);

  // Passing a `controls` object to the ref whose methods reference internal state.
  controls({
    increment() {
      $count((current) => current + 1);
    },
    decrement() {
      $count((current) => current - 1);
    },
    reset() {
      $count(0);
    },
  });

  return <span>Count: {$count}</span>;
}

// Then we'll use it in the parent:

function ParentView() {
  // Create a Ref to store the controls object.
  const controls = ref<CounterViewControls>();

  return (
    <section>
      <h1>Counter</h1>

      {/* CounterView will set the controls object */}
      <CounterView controls={controls} />

      {/* Our buttons will call the methods on the controls object causing state changes within CounterView */}
      <button onClick={() => controls.increment()}>+1</button>
      <button onClick={() => controls.decrement()}>-1</button>
      <button onClick={() => controls.reset()}>=0</button>
    </section>
  );
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
