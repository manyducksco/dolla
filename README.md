# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

> WARNING: This package is in active development. It may contain serious bugs and docs may be outdated or inaccurate. Use at your own risk.

Dolla is a batteries-included JavaScript frontend framework covering the needs of moderate-to-complex single page apps:

- ⚡ Reactive DOM updates with [Signals](./docs/state.md).
- 📦 Reusable components with [Views](./docs/views.md).
- 💾 Reusable state management with [Stores](./docs/stores.md).
- 🔀 Client side [routing](./docs/router.md) with nested routes and middleware support (check login status, preload data, etc).
- 🐕 Built-in [HTTP](./docs/http.md) client with middleware support (set auth headers, etc).
- 📍 Lightweight [localization](./docs/i18n.md) system (store translated strings in JSON files and call the `t` function to get them).
- 🍳 Build system optional. [Write views in JSX](./docs/setup.md) or bring in [HTM](https://github.com/developit/htm) and use tagged template literals directly in the browser.

Dolla's goals:

- Be fun to create with.
- Be snappy and responsive for real life apps.
- Be as compact as possible but not at the expense of necessary features.

## DEV TO-DO

- Make sure docs are correct and accurate.
- Release v2.0.0

## An Example

A basic view. Note that the view function is called exactly once when the view is first mounted. All changes to DOM nodes thereafter happen as a result of `$state` values changing.

```jsx
import { useSignal, useEffect, createApp } from "@manyducks.co/dolla";

function Counter() {
  const [$count, setCount] = useSignal();

  function reset() {
    setCount(0);
  }

  function increment() {
    setCount((current) => current + 1);
  }

  function decrement() {
    setCount((current) => current - 1);
  }

  // Runs once when the view is mounted, then again every time $count receives a new value.
  useEffect(() => {
    console.log("Count is: " + $count());
  });

  return (
    <div>
      {/* Signals can be slotted into the DOM to render them */}
      <p>Counter: {$count}</p>

      {/* Signals are just functions that return a value, so you can compose them on the fly */}
      <Show when={() => $count() > 100}>
        <p>That's a lot of clicks.</p>
      </Show>

      <div>
        <button onClick={increment}>+1</button>
        <button onClick={decrement}>-1</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

const app = createApp(Counter);
app.mount(document.body);
```

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
