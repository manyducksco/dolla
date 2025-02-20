# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

> WARNING: This package is in active development. It may contain serious bugs and docs may be outdated or inaccurate. Use at your own risk.

Dolla is a batteries-included JavaScript frontend framework covering the needs of moderate-to-complex single page apps:

- ⚡ Reactive DOM updates with [Signals](./docs/state.md).
- 📦 Reusable components with [Views](./docs/views.md).
- 💾 Reusable state management with [Stores](./docs/stores.md).
- 🔀 Built-in [routing](./docs/router.md) with nested routes and middleware support (check login status, preload data, etc).
- 🐕 Built-in [HTTP](./docs/http.md) client with middleware support (set auth headers, etc).
- 📍 Built-in [localization](./docs/i18n.md) system (store translated strings in JSON files and call the `t` function to get them).
- 🍳 Build system optional. [Write views in JSX](./docs/setup.md) or use `html` tagged template literals.

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

```js
import Dolla, { atom, html } from "@manyducks.co/dolla";

function Counter() {
  const count = atom(0);

  return html`
    <div>
      <p>Counter: ${count}</p>
      <div>
        <button onclick=${() => count.value--}>-1</button>
        <button onclick=${() => count.value++}>+1</button>
      </div>
    </div>
  `;
});

Dolla.mount(document.body, Counter);
```

> TODO: Show small examples for routing and stores.

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
