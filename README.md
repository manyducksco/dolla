# 💲 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a research framework for trying out ideas. The goal is to create a full-featured framework that, first and foremost, provides the best developer experience possible out of the box. Low resource usage and small code size are secondary objectives. It's more than a toy and less than a production-ready workhorse. It's a labor of love. Use at your own joy and peril.

- ⚡️ [**Signals**](./docs/signals.md) for pinpoint DOM updates.
- 📦 Two types of [components](./docs/components.md):
  - 🖥️ [**Views**](./docs/views.md) for reusable UI elements.
  - 💾 [**Stores**](./docs/stores.md) for sharing common state between many components.
- 🔀 A client-side [**router**](./docs/router.md) with nested routes, auth guards, async data loading and more.
- 📍 A simple [**i18n system**](./docs/i18n.md). Just put your translated strings into a JSON file and access them with the `t` function in your views.
- 🍳 The build step is optional. You can [write JSX](./docs/jsx.md) with a bundler, or use tagged template literals directly in the browser.

## ...

Static Execution (Setup Once): Unlike React, a Dolla component is a constructor that runs exactly once. It builds the UI and "wires up" the reactivity, then steps out of the way. This eliminates the overhead of constant re-renders and the "stale closure" bugs common in other frameworks.

- State primitives that work inside and outside of components
- Context chain behind component tree
- Direct DOM updates with signals, but with opt-in tracking (reduces accidental subscriptions w/ signals)

### Topics to introduce

- Reactivity
  - Signals
  - tracking contexts (memo, effect, attributes and children)
- Components
  - basic types overview
  - lifecycle: `onMount`, `onCleanup`
  - context
  - Views
    - reactive props/attrs
    - helpers (`repeat`, `when`, `portal`)
  - Stores (with `provide` and `inject`)
- mount
- Extras
  - Router
  - Translate
  - Building with Vite & using JSX

## Example: Counter

```jsx
import { state, html, mount, onMount, onCleanup, onEffect } from "@manyducks.co/dolla";

function Counter() {
  const count = state(0);

  onMount(this, () => {
    console.log("Counter has mounted.");
  });

  onCleanup(this, () => {
    console.log("Counter has unmounted.");
  });

  onEffect(this, () => {
    console.log({ count: count() });
  });

  return html`
    <div>
      <p>Count: ${count}</p>
      <button onclick=${() => count((c) => c + 1)}>Increment</button>
    </div>
  `;
}

mount(Counter, document.body);
```

That will give you a basic counter mounted to the body of your document with a button you can click to increase the number. Reactivity is fully wired up.

Components never re-render in Dolla. They are one-shot constructor functions that get called when the component is created. The `state` function creates a reactive value and returns a pair of functions, the first of which a getter and the second a setter.

In the Counter view, we were just passing the getter itself into the `<p>` tag. Getters have a special side-effect that calling them inside specific functions will track them, causing the parent function to re-run when the tracked values are updated. Dolla handles this tracking process automatically when you drop getters into your template as attributes or children.

Tracking contexts

- memo()
- HTML element attributes
- HTML element children
- NOT event handlers

## Example: Temperature Converter

```tsx
import { state, memo, html, mount } from "@manyducks.co/dolla";

function Converter() {
  const celsius = state(0);

  // Depends on `celsius`; updates when `celsius` updates.
  const fahrenheit = memo(() => {
    return (celsius() * 9) / 5 + 32;
  });

  // Depends on `fahrenheit`; updates when `fahrenheit` updates.
  const description = memo(() => {
    const f = fahrenheit();
    if (f <= 32) return "Freezing ❄️";
    if (f >= 90) return "Hot! 🔥";
    return "Moderate 🌤️";
  });

  return html`
    <div>
      <input
        type="number"
        value=${celsius}
        oninput=${(e) => {
          celsius(e.target.valueAsNumber);
        }}
      />

      <p>Celsius: ${celsius}°C</p>
      <p>Fahrenheit: ${fahrenheit}°F</p>
      <p>Condition: ${description}</p>
    </div>
  `;
}

mount(Converter, document.body);
```

The `memo` function creates a read-only signal that derives its state from other signals. Its callback function is called immediately, accessed signals are tracked as dependencies, and then the callback runs again if any of those dependencies change. Calling the memoized signal in the meantime will simply return the last computed value.

### 2\. Stores: For your shared state

Got some state you need to use in a bunch of different places? **Stores** are for that. It's Dolla's built-in way to handle state so you don't have to go install another library.

You work with stores using two functions, `$provide` and `$use`.

```jsx
function CounterStore() {
  // We create an atom which gives us a getter, and a setter which we won't expose.
  const [value, setValue] = atom(0);

  // Instead we can define our own functions to control how the state gets changed.
  const increment = () => setValue((current) => current + 1);
  const decrement = () => setValue((current) => current - 1);

  // This object is accessible to other components that use this store.
  return { value, increment, decrement };
}
```

You "provide" a store to a part of your app, and any component inside can now use it.

```jsx
function App() {
  // Now this component and any components inside it share an instance of CounterStore.
  const counter = $provide(CounterStore);

  return (
    <div>
      <CounterView />
      <button onClick={counter.increment}>Increment</button>
    </div>
  );
}

function CounterView() {
  // Just use the store you need!
  const counter = $use(CounterStore);
  return <p>Current value: {counter.value}</p>;
}
```

[More on stores.](./docs/stores.md)

### 3\. Mixins: Reusable superpowers

**Mixins** are a super cool way to add reusable behaviors to your HTML elements. A mixin is just a function you can slap onto any element, and it can have its own state and lifecycle. It's perfect for stuff like logging, animations, or whatever else you can dream up.

```jsx
function logLifecycle() {
  // A mixin is just a function...
  return (element) => {
    // ...that takes a DOM element and can use hooks inside.
    const log = $debug();
    $mount(() => log("element mounted!", element));
    $unmount(() => log("element unmounted!"));
  };
}

// Then you can use it in any View.
function MyComponent() {
  return (
    <div>
      {/* Just call it in the `mixin` prop. */}
      <h1 mixin={logLifecycle()}>I'll log when I show up and leave.</h1>

      {/* You can even use an array of 'em! */}
      <p mixin={[logLifecycle(), otherMixin()]}>Me too!</p>
    </div>
  );
}
```

[More on mixins.](./docs/mixins.md)

## Batteries Included: All The Stuff You Get\! 🧰

Dolla isn't just for rendering. We threw in a bunch of tools so you can stop hunting around on npm.

### A Router that Doesn't Suck

Dolla has a router for making multi-page apps. It just works. Back/forward buttons, bookmarks, all that jazz. It's also smart and always picks the _most specific_ route, so you don't get weird bugs based on the order you write your routes.

#### Route Patterns

- **Static**: `/dashboard/settings`
- **Number Param** (only matches numbers): `/users/{#id}`
- **Anything Param**: `/users/{name}`
- **Wildcard**: `/files/*`

#### Setting it Up

```jsx
import { dolla } from "@manyducks.co/dolla";
import { ThingIndex, ThingDetails, ThingEdit } from "./views.js";

const app = dolla({
  // You can use `/#/hash` routes if you don't have a server configured to handle client route fallback.
  hash: true,

  // Configure `routes` instead of providing a `view`.
  routes: [
    {
      path: "/things",
      view: null, // a null view just groups routes
      routes: [
        { path: "/", view: ThingIndex }, // matches `/things`
        { path: "/{#id}", view: ThingDetails }, // matches `/things/123`
        { path: "/{#id}/edit", view: ThingEdit }, // matches `/things/123/edit`
      ],
    },
    { path: "*", redirect: "/things" }, // catch-all
  ],
});

app.mount(document.body);
```

#### Using It

Just use the `$router()` hook.

```jsx
import { $effect, $debug, $router } from "@manyducks.co/dolla";

function ThingDetails() {
  const log = $debug();
  const router = $router();

  const id = compose(() => router.params().id);

  $effect(() => {
    log("Current thing ID:", id());
  });

  function goToNext() {
    const nextId = id() + 1;
    router.go(`/things/${nextId}`);
  }

  return (
    <div>
      <p>Viewing thing {id}</p>
      <button onClick={goToNext}>View Next Thing</button>
    </div>
  );
}
```

### Internationalization (i18n)

Wanna make your app speak different languages? We got you. Dolla's i18n stuff is super simple.

The best part? `t()` gives you back a **signal**. So if the user switches languages, your whole app just updates. Automatically. It's kinda magic.

```jsx
import { dolla, $i18n } from "@manyducks.co/dolla";

function CounterView() {
  const { t, setLocale } = $i18n();

  // setLocale("ja")

  return <button>{t("buttonLabel")}</button>;
}

const app = dolla({
  view: CounterView,
  i18n: {
    locale: "en",
    translations: [
      { locale: "en", strings: { buttonLabel: "Click me!" } },
      { locale: "ja", strings: { buttonLabel: "押してね！" } },
    ],
  },
});

app.mount(document.body);
```

---

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
