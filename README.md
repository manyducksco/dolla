# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Alright, so Dolla is this new web framework. Ngl, it's pretty sick. It feels like you're writing React, which is cool, but it's also got this crazy fast reactivity thing going on under the hood. It’s built to feel super familiar, but like, way easier to figure out and it comes with all the stuff you actually need to build something.

- ⚡️ [**Signals**](./docs/signals.md) make your UI updates hit different. Your DOM just refreshes instantly, it's lowkey magic.
- 📦 You got options for [components](./docs/components.md), three different vibes:
  - 🖥️ [**Views**](./docs/views.md) are for the UI glow up. You know the drill.
  - 💾 [**Stores**](./docs/stores.md) are for when your components need to share state without all the drama. We don't do prop drilling in this house.
  - ✨ [**Mixins**](./docs/mixins.md) give your plain HTML elements some extra rizz. Slay.
- 🪝 [**Hooks**](./docs/hooks.md) let your components actually cook. They're your familiar, React-style toolkit for state (`useSignal`), lifecycle (`useMount`), and more.
- 🔀 The client-side [**router**](./docs/router.md) actually understands the assignment. Nested routes, middleware for gatekeeping pages (iykyk), preloading data so it's not laggy... it's all there.
- 🐕 It comes with its own [**HTTP client**](./docs/http.md) so you can stop installing axios. It's got middleware too, so adding auth headers to every request is easy. We stan.
- 📍 A lowkey [**i18n system**](./docs/i18n.md). Just yeet your translations into a JSON file and the `t` function pulls them. Simple.
- 🍳 And the biggest flex? The build system is optional. You can [write your JSX like always](./docs/setup.md), or just [use tagged template literals](./docs/buildless.md) straight in the browser with [HTM](https://github.com/developit/htm). It's a whole vibe.

## Check it out: The Counter Example

The best way to get it is to just see it. If you've ever touched React, you'll know what's up, but peep the little things that make your life way easier.

```jsx
import { useSignal, useEffect, createApp } from "@manyducks.co/dolla";

function Counter() {
  // 1. Make a reactive thingy, we call it a "signal".
  const [$count, setCount] = useSignal(0);

  function increment() {
    setCount((current) => current + 1);
  }

  // 2. This effect just works. It knows to re-run when $count changes. No drama.
  useEffect(() => {
    // to get a signal's value, just call it like a function. easy.
    console.log("Count is: " + $count());
  });

  return (
    <div>
      {/* 3. In your HTML, just drop the signal right in. */}
      <p>Counter: {$count}</p>

      {/* 4. Using signals with helpers like <Show> is a total breeze. */}
      <Show when={() => $count() > 100}>
        <p>Whoa, that's a lotta clicks!</p>
      </Show>

      <div>
        <button onClick={increment}>+1</button>
        {/* ... other buttons */}
      </div>
    </div>
  );
}
```

### 1\. `useSignal` - State that's actually simple

You make state with `useSignal()`, and it gives you back a `[getter, setter]` pair, just like `useState` in React.

- `$count`: This is the **signal**. We just use a `$` at the start by convention. Think of it as a reactive value you can just plop into your JSX.
- `setCount`: This is how you change the value. Works just like you'd think.

When you need the value in your JS code (like in an `useEffect`), just call it like a function: `$count()`.

### 2\. Effects without the headache

`useEffect` and `useMemo` are here, but they're way more chill.

- **Automatic Tracking (by default\!)**: You literally don't have to do anything. Dolla just sees what signals you used and re-runs your code when they change.
- **Manual Tracking (if you're feeling extra)**: If you _really_ want to, you can give it an array of signals to watch. Then it'll _only_ pay attention to those.

<!-- end list -->

```jsx
const [$count, setCount] = useSignal(0);
const [$name, setName] = useSignal("Dolla");

// AUTOMATIC: Runs if $count OR $name changes. Simple.
useEffect(() => {
  console.log(`Yo ${$name()}, the count is ${$count()}`);
});

// MANUAL: This ONLY runs when $count changes.
// We're using $name() in here, but the effect is like "I don't see it" lol.
useEffect(() => {
  console.log(`Yo ${$name()}, the count is ${$count()}`);
}, [$count]);
```

### 3\. No VDOM, no problem

Behind the scenes, Dolla isn't re-running your whole component all the time. Nah. It makes a direct connection from your signal to the exact spot in the HTML that uses it.

When you `setCount(1)`, Dolla knows only the `<p>` tag and the `<Show>` component care. So it just updates those two things. It's like a ninja. This means no VDOM overhead and it's fast af by default.

## The Dolla Building Blocks

Dolla gives you a few types of components to keep your code from becoming a mess: **Views**, **Stores**, and **Mixins**. They're all connected by this thing called **context**, which you can grab with `useContext()`.

### 1\. Views: Your UI stuff

**Views** are your normal, everyday components for putting stuff on the screen. If you know React components, you're already a pro. They get `props`, use hooks, and return JSX.

```jsx
function ExampleView(props) {
  const context = useContext();
  const [$count, setCount] = useSignal(0);

  // The logger automatically knows the component's name!
  context.log("sup from ExampleView");

  useMount(() => context.log("we're live!"));
  useUnmount(() => context.log("aight, i'm out"));

  return <div>{$count}</div>;
}
```

### 2\. Stores: For your shared state

Got some state you need to use in a bunch of different places? **Stores** are for that. It's Dolla's built-in way to handle state so you don't have to go install another library.

```jsx
function CounterStore() {
  const [$value, setValue] = useSignal(0);

  // You can return functions to control how the state gets changed.
  const increment = () => setValue((current) => current + 1);
  const decrement = () => setValue((current) => current - 1);

  return { $value, increment, decrement };
}
```

You "provide" a store to a part of your app, and any component inside can just grab it.

```jsx
function App() {
  // Now, App and any components inside it can use CounterStore.
  const counter = useStoreProvider(CounterStore);

  return (
    <div>
      <CounterView />
      <button onClick={counter.increment}>Increment</button>
    </div>
  );
}

function CounterView() {
  // Just ask for the store you need!
  const counter = useStore(CounterStore);
  return <p>Current value: {counter.$value}</p>;
}
```

### 3\. Mixins: Reusable superpowers

**Mixins** are a super cool way to add reusable behaviors to your HTML elements. A mixin is just a function you can slap onto any element, and it can have its own state and lifecycle. It's perfect for stuff like logging, animations, or whatever else you can dream up.

```jsx
function logLifecycle() {
  // A mixin is just a function...
  return (element) => {
    // ...that takes an element and can use hooks inside.
    const context = useContext();
    useMount(() => context.log("element mounted!", element));
    useUnmount(() => context.log("element unmounted!"));
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

### 4\. So, what's this "Context" thing anyway?

**Context** is basically the glue that holds all your components together. Think of it like a family tree. Every component has its own context, but it's linked to its parent. This lets you do some cool stuff:

- **Finding Things**: When you do `useStore(CounterStore)`, Dolla just climbs up the family tree from your component until it finds where you provided the store. It's how some component deep in your app can get state from way up top.
- **Helpful Tools**: The context itself has some neat tricks. The logging methods (`.log()`, `.warn()`, etc.) automatically know your component's name, which is awesome for debugging. There's even a `.crash()` that'll just stop the app and show an error page if things go really wrong. You can get and set the component's name with `context.getName()` and `context.setName()`.
- **Deep-level State**: Context has its own key-value state system with `setState()` and `getState()`. The framework uses this a bunch. It's there if you wanna get wild, but tbh, for your app's state, **you should probably just use Stores.** They're way easier.

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
import { createApp } from "@manyducks.co/dolla";
import { createRouter } from "@manyducks.co/dolla/router";
import { ThingIndex, ThingDetails, ThingEdit } from "./views.js";

const router = createRouter({
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

const app = createApp(router);
app.mount(document.body);
```

#### Using It

Just use the `useRouter()` hook.

```jsx
import { useEffect } from "@manyducks.co/dolla";
import { useRouter } from "@manyducks.co/dolla/router";

function ThingDetails() {
  const router = useRouter();
  const { $params } = router; // get reactive params

  useEffect(() => {
    console.log("Current thing ID:", $params().id);
  });

  function goToNext() {
    const nextId = $params().id + 1;
    router.go(`/things/${nextId}`);
  }

  return (
    <div>
      <p>Viewing thing #{$params().id}</p>
      <button onClick={goToNext}>View Next Thing</button>
    </div>
  );
}
```

### A Built-in HTTP Client

Dolla has a little `http` client for API calls. It automatically parses JSON and has a sick middleware system.

```jsx
import { http } from "@manyducks.co/dolla/http";

// Automatically add an auth header to all API calls
http.use(async (req, next) => {
  if (req.url.pathname.startsWith("/api/")) {
    req.headers.set("authorization", `Bearer ${localStorage.getItem("api-key")}`);
  }
  await next(); // don't forget this part!
});

const res = await http.get("/api/users");
console.log(res.body); // already parsed JSON, leggo
```

### Internationalization (i18n)

Wanna make your app speak different languages? We got you. Dolla's i18n stuff is super simple.

The best part? `t()` gives you back a **signal**. So if the user switches languages, your whole app just updates. Automatically. It's kinda magic.

```jsx
import { createApp, useSignal } from "@manyducks.co/dolla";
import { i18n, t } from "@manyducks.co/dolla/i18n";

function CounterView() {
  return <button>{t("buttonLabel")}</button>;
}

const app = createApp(CounterView);

// Set up your languages before you start the app
i18n
  .setup({
    locale: "en",
    translations: [
      { locale: "en", strings: { buttonLabel: "Click me!" } },
      { locale: "ja", strings: { buttonLabel: "押してね！" } },
    ],
  })
  .then(() => app.mount(document.body));
```

## The Tea: How's Dolla Different?

<!-- ### vs. React

- **Easier Effects**: You know that annoying dependency array? Gone. Unless you, like, _want_ to use it.
- **State Management Included**: `Stores` are built in, so you can probably skip installing Redux or Zustand.
- **Faster**: No VDOM = faster.
- **Smaller**: Less code for your users to download. -->

### vs. React

- **No More Re-Renders (Fr!)**: This is the big one. In React, when you call `setCount(1)`, your _entire component function runs all over again_. React then has to figure out what changed with the VDOM. In Dolla, your component function only runs once, ever. When you call `setCount(1)`, Dolla just goes and changes the text in that one `<p>` tag. That's it. This makes it way faster and easier to reason about.
- **Goodbye, `useCallback`**: Because React re-renders all the time, it creates new functions and objects on every single render. This is why you have to wrap everything in `useCallback` and `useMemo` so you don't cause a chain reaction of re-renders in your child components. Since Dolla components don't re-render, you can just pass a regular function as a prop without a single worry. No more referential equality drama.
- **Easier Effects**: You know that annoying dependency array? Gone. Unless you, like, _want_ to use it for manual control. This means no more stale closure bugs.
- **State Management Included**: `Stores` are built in, so you can probably skip installing Redux or Zustand and all the boilerplate that comes with them.

### vs. Angular

- **Way Less Boilerplate**: Angular is a whole ceremony. Modules, decorators, dependency injection... it's a lot. Dolla is just functions. You write a function, it becomes a component. It's a much more direct vibe.
- **Stores are like Services, but chill**: Ngl, our `Stores` were lowkey inspired by Angular's services. It's the same idea of providing a thing in one place and using it somewhere else. But instead of all the module and decorator ceremony, you just use a couple of simple hooks.
- **Signals First, Not an Add-on**: Yeah, Angular has signals now, but the whole framework was built on a different system (Zone.js). Dolla was born with signals as its main character, so the whole DX is built around them. It's not an optional extra, it's the whole point.

### vs. Svelte

- **It's Just JS**: Dolla is just functions and JSX. Svelte has its own `.svelte` file type and special syntax. Dolla just fits into the normal JS world.
- **Clearer Updates**: In Dolla, you `setCount(1)`. You know what's happening. In Svelte, `count += 1` is kinda magic.
- **Consistent Vibe**: Everything in Dolla uses the same hook style. It all feels the same.

### vs. SolidJS

Okay, Solid is sick, ngl. It uses signals too. The main difference is the vibe. Solid is like getting a super-tuned car engine. **Dolla is the whole car.** With heated seats and a good sound system.

Choose **SolidJS** if you wanna build your car from scratch.

Choose **Dolla** if you wanna just get in and drive.

---

For more detail [check out the Docs](./docs/index.md).

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
