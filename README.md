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

Dolla's goals include:

- Be fun to create with.
- Be snappy and responsive for real life apps.
- Be compact as possible but not at the expense of necessary features.

## Why Dolla?

> TODO: Write about why Dolla was started and what it's all about.

- Borne of frustration using React and similar libs (useEffect, referential equality, a pain to integrate other libs into its lifecycle, need to hunt for libraries to move much beyond Hello World).
- Merges ideas from my favorite libraries and frameworks (Solid/Knockout, Choo, Svelte, i18next, etc) into one curated set designed to work well together.
- Opinionated (with the _correct_ opinions).
- Many mainstream libraries seem too big for what they do. The entirety of Dolla is less than half the size of [`react-router`](https://bundlephobia.com/package/react-router@7.1.5).

## An Example

A basic view. Note that the view function is called exactly once when the view is first mounted. All changes to DOM nodes thereafter happen as a result of `$state` values changing.

```jsx
import { $, effect, when, mount } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const $count = $(0);

  effect(() => {
    console.log("Count is: " + $count());
    // An effect will re-run whenever any signal accessed inside it receives a new value.
  });

  function reset() {
    $count.set(0);
  }

  function increment() {
    $count.set((current) => current + 1);
  }

  function decrement() {
    $count.set((current) => current - 1);
  }

  return (
    <div>
      <p>Counter: {$count}</p>
      {/* Signals can be slotted into the DOM to render them */}

      <div>
        <button onClick={increment}>+1</button>
        <button onClick={decrement}>-1</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

mount(Counter, document.body);
```

> TODO: Show small examples for routing and stores.

```js
function MessageStore(options, ctx) {
  const message = $("Hello world!");

  ctx.effect(() => {
    ctx.log(`Message is now: ${message()}`);
    // Calling `get()` inside an effect (or compose) function will track that reactive value as a dependency.
    // Effects will re-run when a dependency updates.
  });
  // `ctx` refers to the context object; StoreContext in a store and ViewContext in a view.
  // Context objects contain methods for controlling the component, logging and attaching lifecycle hooks.

  return {
    $message: $(() => message()),
    setMessage: (value: string) => message.set(value.toUpperCase()),
  };
}

function App(props, ctx) {
  // Provide a store for this and all child views.
  ctx.addStore(MessageStore);

  const { $message, setMessage } = ctx.getStore(MessageStore);
  // Provides a MessageStore on this context and any child contexts.
  // When a store is provided its value is returned right away.

  return (
    <div>
      <MessageView />
      <MessageView />
      <MessageView />

      <input
        type="text"
        value={$message}
        onInput={(e) => {
          setMessage(e.currentTarget.value);
        }}
      />
    </div>
  );
}

function MessageView(props, ctx) {
  const { message } = ctx.getStore(MessageStore);
  // Gets the nearest instance of MessageStore. In this case the one provided at the parent.

  return <span>{message}</span>;
}
```

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
