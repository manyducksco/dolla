# 💲 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a research framework for trying out ideas. The goal is to create a full-featured framework that, first and foremost, provides the best developer experience possible out of the box. Low resource usage and small code size are secondary objectives. It's more than a toy and less than a production-ready workhorse. It's a labor of love. Use at your own joy and peril.

- ⚡️ [**Signals**](./docs/signals.md) for pinpoint DOM updates.
- 📦 Two types of [components](./docs/components.md):
  - 🖥️ [**Views**](./docs/views.md) for reusable UI elements.
  - 💾 [**Stores**](./docs/stores.md) for sharing common state between many components.
- 🪝 [**Hooks**](./docs/hooks.md) for reaching into the component context and hooking into stores, lifecycle and more.
- 🔀 A client-side [**router**](./docs/router.md) with nested routes, auth guards, async data loading and more.
- 📍 A simple [**i18n system**](./docs/i18n.md). Just put your translated strings into a JSON file and access them with the `t` function in your views.
- 🍳 The build system is optional. You can [write JSX](./docs/setup.md) with a bundler, or [use tagged template literals](./docs/buildless.md) directly in the browser.

## ...

Static Execution (Setup Once): Unlike React, a Dolla component is a constructor that runs exactly once. It builds the UI and "wires up" the reactivity, then steps out of the way. This eliminates the overhead of constant re-renders and the "stale closure" bugs common in other frameworks.

- State primitives that work inside and outside of components
- Context chain behind component tree
- Direct DOM updates with signals, but with opt-in tracking (reduces accidental subscriptions w/ signals)

### Topics to introduce

- Reactivity
  - Reactive, Mutable API
  - tracking contexts (memo, `$watch`, `<For>` render, getters -- goes into views)
- Components
  - basic types overview
  - ($hooks) lifecycle and `$setup`, `$teardown`
  - context (and `$$context` special hook)
  - Views
    - reactive element props/attrs
    - control flow with `<Show>`, `<For>`
    - `<Portal>`
    - Error handling with `<Boundary>` and `$catch`
  - Mixins
  - Stores (and `$provide` and `$use`)
- createRoot
  - mount + unmount
  - plugins
- Extras
  - Router
  - Translate
  - Building with Vite & using JSX

## Example: Counter

```jsx
import { state, html, createRoot } from "@manyducks.co/dolla";

function Counter() {
  const count = state(0);

  count.peek();
  count.watch();

  return html`
    <div>
      <p>Count: ${count}</p>
      <button onclick=${() => count.set((c) => c + 1)}>Increment</button>
    </div>
  `;
}

const count = atom(0);
const doubled = compose(() => count.watch() * 2);

interface Reactive<T> {
  peek(): T;
  watch(): T;
}

interface Atom<T> extends Reactive<T> {
  set(value: T): T;
  set(fn: (current: T) => T): T;
}

function Counter() {
  const [count, setCount] = state(0);

  return html`
    <div>
      <p>Count: ${count}</p>
      <button onclick=${() => setCount((c) => c + 1)}>Increment</button>
    </div>
  `;
}

createRoot(document.body).mount(Counter);
```

That will give you a basic counter mounted to the body of your document with a button you can click to increase the number. Reactivity is fully wired up.

Components never re-render in Dolla. They are one-shot constructor functions that get called when the component is created. The `state` function creates a container called a `Mutable`. A `Mutable` is a type of reactive container that holds a value which can be updated at runtime. Follows are the type signatures for reactive values in Dolla.

```ts
interface Reactive<T> {
  // Returns the currently held value.
  peek(): T;

  // Tracks this container when called inside certain functions, then returns the current value.
  // A tracked reactive will cause the scope it was called in to run again each time the value changes.
  track(): T;
}

interface Mutable<T> extends Reactive<T> {
  // Replaces the currently held value, notifying all observers. Returns the new value.
  set(value: T): T;

  // Sets the value through a callback. The callback takes the current value and returns a new one.
  set(callback: (current: T) => T): T;
}
```

In the Counter view, we were just passing the container itself into the `<p>` tag. The view knows to `.track()` that value automatically when it sees one. We can also create our own non-mutable `Reactive`s and track values ourselves.

## Example: Temperature Converter

```tsx
import { state, memo, html } from "@manyducks.co/dolla";

function Converter() {
  const [celsius, setCelsius] = state(0);

  const fahrenheit = memo(() => {
    return (celsius() * 9) / 5 + 32;
  });

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
        onchange=${(e) => {
          setCelsius(e.target.valueAsNumber);
        }}
      />

      <p>Celsius: ${celsius}°C</p>
      <p>Fahrenheit: ${fahrenheit}°F</p>
      <p>Condition: ${description}</p>
    </div>
  `;
}
```

The `computed` function creates a read-only `Reactive`. That `Reactive` holds the latest return value of the callback function. That function is called once right away, then again each time its tracked values change. Tracking in Dolla is explicit. Calling `.track()` is our _signal_ that we want the `computed` to update when our value changes.

If we called `.get()` we would have the current value at first, but `computed` wouldn't track it.

```ts
const [count, setCount] = state(2);
const doubled = memo(() => {
  return peek(count) * 2;
});

doubled.get(); // is 4
count.get(); // is 2
```

That seems to be working as expected, but if we update `count` things don't update:

```ts
count.set(15);

doubled.get(); // still 4
count.get(); // now 15
```

We can fix this by opting in to tracking with `.track()` instead of simply getting the value with `.get()`:

```ts
const count = state(2);
const doubled = computed(() => {
  return count.track() * 2; // we're tracking now
});

doubled.get(); // is 4
count.get(); // is 2

count.set(15);

doubled.get(); // now 30
count.get(); // now 15
```

This makes the relationship between `count` and `doubled` very apparent. We need `doubled` to update when the value of `count` is changed.

## Example: To Do List

```tsx
// bind, <For> and getter functions

function ToDoList() {
  const items = ["React", "Vue", "Angular", "Svelte", "Solid", "Dolla"];
  const [query, setQuery] = state("");

  const filtered = memo(() => {
    return items.toLowerCase().includes(query().toLowerCase());
  });

  return (
    <div>
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onInput={(e) => {
          setQuery(e.target.value);
        }}
      />

      <ul>
        <For each={filtered} key={(item) => item}>
          {(item, index) => <li>{item}</li>}
        </For>
      </ul>

      <p>Showing {() => filtered().length} result(s)</p>
    </div>
  );
}

// Hooks and <Show>

function $fetch(url) {
  const [data, setData] = state();

  $watch(() => {
    fetch(url)
      .then((res) => res.json())
      .then((json) => setData(json));
  });

  return { data };
}

function Fetcher() {
  const { data } = $fetch("https://api.example.com/data");

  return (
    <Show when={data} fallback={<p>Loading...</p>}>
      <pre>{() => JSON.stringify(data(), null, 2)}</pre>
    </Show>
  );
}
```

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
