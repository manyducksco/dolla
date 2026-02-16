# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a JavaScript framework built around signals for reactive updates,

- ⚡️ [**Signals**](./docs/signals.md) for pinpoint DOM updates.
- 📦 Three types of [components](./docs/components.md):
  - 🖥️ [**Views**](./docs/views.md) for reusable UI elements.
  - 💾 [**Stores**](./docs/stores.md) for sharing common state between many components.
  - ✨ [**Mixins**](./docs/mixins.md) for augmenting DOM nodes without writing a whole new view.
- 🪝 [**Hooks**](./docs/hooks.md) let your components actually cook. They're your familiar, React-style toolkit for state (`useSignal`), lifecycle (`useMount`), and more.
- 🔀 A client-side [**router**](./docs/router.md) with nested routes and middleware for auth guards, preloading data or analytics.
- 📍 A simple [**i18n system**](./docs/i18n.md). Just put your translations into a JSON file and access them with the `t` function in your views.
- 🍳 The build system is optional. You can [write JSX](./docs/setup.md), or just [use tagged template literals](./docs/buildless.md) straight in the browser with [HTM](https://github.com/developit/htm).

## A Counter

The best way to get it is to see it. If you've ever touched React, you'll know what's up, but peep the little things that make your life way easier.

```jsx
import { state, computed, $watch, $debug } from "@manyducks.co/dolla";

// Print only 'warn' messages and above (applies globally)
$debug.level = "warn"
// Print all but those with prefix "dolla."
$debug.filter = "*,-dolla.*"

// Example

function Counter(props) {
  const count = state(0);
  
  const debug = $debug();
  
  $watch(() => {
    debug.log("Count is: " + count.track());
  });

  return (
    <div>
      {/*  */}
      <p>Counter: {count}</p>

      {/*  */}
      <Show when={() => count.track() > 100}>
        <p>Whoa, that's a lotta clicks!</p>
      </Show>

      {/*  */}
      <button onClick={() => count.update((value) => value + 1)}>Increment</button>
      <button onClick={() => count.update((value) => value - 1)}>Decrement</button>
      <button onClick={() => count.write(0)}>Reset</button>
    </div>
  );
}
```

### 3\. No VDOM, no problem

Behind the scenes, Dolla isn't re-running your whole component all the time. Nah. It makes a direct connection from your signal to the exact spot in the HTML that uses it.

When you `setCount(1)`, Dolla knows only the `<p>` tag and the `<Show>` component care. So it just updates those two things. No VDOM rebuild, no diffing.

## The Dolla Building Blocks

Dolla gives you a few types of components to keep your code from becoming a mess: **Views**, **Stores**, and **Mixins**. They're all connected by this thing called **context**, which you can grab with `useContext()`.

### 1\. Views: Your UI stuff

**Views** are your normal, everyday components for putting stuff on the screen. If you know React components, you're already a pro. They get `props`, use hooks, and return JSX.

```jsx
function ExampleView(props) {
  const context = $context();
  const count = signal(0);

  // The logger automatically knows the component's name!
  context.log("sup from ExampleView");

  useMount(() => context.log("we're live!"));
  useUnmount(() => context.log("aight, i'm out"));

  return <div>{$count}</div>;
}
```

[More on views.](./docs/views.md)

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
  }
});

app.mount(document.body);
```

---

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
