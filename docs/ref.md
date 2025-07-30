# Refs: For When You Gotta Get Your Hands Dirty

Aight, so what's a **ref**? It's basically a little box for holding onto a value. It's a function, so `myRef()` gets you the value, and `myRef(newValue)` sets a new one. If you try to get a value from an empty ref, it'll throw a fit, so heads up.

Think of it like a signal's uncool cousin—it holds stuff, but it's **not reactive**. It won't trigger updates. It's for when you need to break the rules a little.

## Use Case \#1: Grabbing DOM elements

The main character energy of refs is grabbing actual HTML elements. Just yeet a `ref={myRef}` prop onto any element, and bam, the real DOM node lands in `myRef.current`. Now you can mess with it directly using regular JS, no cap. It's your secret backdoor to the DOM.

```tsx
import { useRef } from "@manyducks.co/dolla";

function ExampleView() {
  const element = useRef<HTMLElement>();

  useMount(() => {
    // We're just changing the text directly on the element. Wild.
    element.current.innerText = "GOODBYE WORLD";
  });

  return <div ref={element}>HELLO WORLD</div>;
}
```

## Use Case \#2: Parent Controlling a Child

This is some next-level strats, fr. You can use a ref to let a parent component control a child. The child makes a little API object—like a remote control—and sends it up to the parent via a ref. Then the parent can just be like `controls.current.increment()` and make the child do stuff. It's a total power move for when you need to break the rules.

```tsx
import { useRef, useSignal } from "@manyducks.co/dolla";

// The child component that's gonna get controlled
interface CounterViewControls {
  increment(): void;
  decrement(): void;
  reset(): void;
}

function CounterView({ controls }: { controls: Ref<CounterViewControls> }) {
  const [$count, setCount] = useSignal(0);

  // We're making our "remote control" and giving it to the parent's ref
  controls.current = {
    increment: () => setCount((c) => c + 1),
    decrement: () => setCount((c) => c - 1),
    reset: () => setCount(0),
  };

  return <span>Count: {$count}</span>;
}

// The parent component doing the controlling
function ParentView() {
  const controls = useRef<CounterViewControls>();

  return (
    <section>
      <h1>Counter</h1>
      <CounterView controls={controls} />

      {/* Now we can use the remote control from the parent! */}
      <button onClick={() => controls.current.increment()}>+1</button>
      <button onClick={() => controls.current.decrement()}>-1</button>
      <button onClick={() => controls.current.reset()}>=0</button>
    </section>
  );
}
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
