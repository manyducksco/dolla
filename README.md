# 💲 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

Dolla is a research framework for trying out ideas. The goal is to create a full-featured framework that, first and foremost, provides the best developer experience possible out of the box. Low resource usage and small code size are secondary objectives. It's more than a toy and less than a production-ready workhorse. It's a labor of love. Use at your own joy and peril.

- 🚥 [**Signals**](./docs/reactivity.md) for pinpoint DOM updates.
- 📦 Reusable components in two types:
  - 🖥️ **Views** for reusable UI elements.
  - 💾 **Stores** for sharing state across many views.
- 🔀 A client-side [**router**](./src/router/README.md) with nested routes, auth guards, async data loading and more.
- 📍 A simple [**i18n system**](./src/translate/README.md). Put your translated strings in a JSON file and access them with the `t` function in your views.
- 🍳 The build step is optional. You can use a bundler (like Vite) and [write JSX](./docs/jsx.md), or skip the build step and use `html` tagged templates.

## Shut up and show me

Here's an app that displays "Hello World" or "Goodbye World" and a button to toggle which message is displayed.

```jsx
import { html, createAtom, createRoot, compose } from "@manyducks.co/dolla";

function Hello() {
  const [value, setValue] = createAtom(false);

  const word = compose(() => (value() ? "Hello" : "Goodbye"));

  return html`
    <p>${word} World</p>
    <button onClick=${() => setValue((current) => !current)}>Toggle</button>
  `;
}

createRoot(document.body).mount(Hello);
```

And here's a counter with a lot more going on, plus some comments to explain what's happening.

```jsx
import { html, createAtom, createRoot, onMount, onCleanup, onEffect, showIf } from "@manyducks.co/dolla";

function Counter(props) {
  // An atom is the basic building block of dynamic state.
  // It consists of a getter function and a setter function, returned as a tuple:
  const [count, setCount] = createAtom(0);

  // Atoms can be composed to derive state from one or more other states.
  // Composed states update automatically with the values of any atoms they call.
  const isALot = compose(() => count() > 100);

  // Composed states are lazy-computed if dependencies have changed.
  isALot(); // computes the value; returns false
  isALot(); // returns cached value (count has not changed)
  isALot(); // returns cached value (count has not changed)

  // Hooks can bind logic to the component lifecycle or store and access data on the context.
  // They always take the Context object as a first argument by convention.
  onMount(this, () => {
    console.log("I'll be called when Counter is on the page");

    // You can call hooks wherever and whenever you want as long as you have a Context object to pass.
    onCleanup(this, () => {
      console.log("I'll be called when Counter is no longer on the page");
    });
  });

  // Effects run side-effect code in response to state changes.
  // Just like `compose`, the effect tracks getters called within and re-runs when values change.
  onEffect(this, () => {
    console.log("count has changed:", count());
  });

  // Getters can be dropped into the DOM where dynamic values are needed,
  // either as children or as HTML attributes. DOM nodes will update in sync with state changes.
  return html`
    <div>
      <p>Count: ${count}</p>

      <button disabled=${isALot} onClick=${() => setCount((current) => current + 1)}>Increment</button>

      ${showIf(isALot, html`<p>That's a lot!</p>`)}
    </div>
  `;
  // ^ You can use view helpers like `showIf`, `hideIf` and `forEach` for control flow in templates.
}

// A root will create and mount an instance of a view onto a DOM node.
createRoot(document.body).mount(Counter);
```

A few points to notice:

- The component function runs only once when the component is initialized (no re-renders).
- _All_ changes at runtime are a result of atoms being set.
- All DOM updates are synchronous with state changes. You can use [`batch`](./docs/reactivity.md) to process several changes as one.
- Getters are tracked in `compose` and `createEffect`/`onEffect` callbacks. You can use [`peek`](./docs/reactivity.md) to opt-out of tracking.

## Dependent data flow

Apps are built by composing atoms into ever more complex data structures, eventually attaching the fingers of the monstrosity to some switches and levers that can manipulate DOM nodes.

Imagine your state as a hamster. Your job is to create a mech suit around the hamster so when he twitches his paw his 10 ton fist takes a chunk out of a mountainside. This is no ordinary hamster; it's your app's state, and the mountainside is the DOM. And the mech suit is your code. Built out of Dolla parts. Yes.

Now that everything is clear, here's what that looks like in practice. Only a single number changes, but three values are displayed in sync with the original number. A few small state changes cause large changes visible to the user. It's easy to understand what data is important.

```tsx
import { html, createRoot, createAtom, compose } from "@manyducks.co/dolla";

function Converter() {
  // Just one source value that changes.
  const [celsius, setCelsius] = createAtom(0);

  // Depends on `celsius`; updates when `celsius` updates.
  const fahrenheit = compose(() => {
    return (celsius() * 9) / 5 + 32;
  });

  // Depends on `fahrenheit`; updates when `fahrenheit` updates.
  const description = compose(() => {
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
          // Set by user input.
          setCelsius(e.target.valueAsNumber);
        }}
      />

      <p>Celsius: ${celsius}°C</p>
      <p>Fahrenheit: ${fahrenheit}°F</p>
      <p>Condition: ${description}</p>
    </div>
  `;
}

createRoot(document.body).mount(Converter);
```

### Stores for shared state

Dolla comes with a really easy way to share state across views in the same subtree.

```jsx
// Define a Store function:
function CounterStore() {
  const [value, setValue] = createAtom(0);

  // We can define our own functions to control how the state gets changed.
  const increment = () => setValue((current) => current + 1);
  const decrement = () => setValue((current) => current - 1);

  // This object is accessible to other components that use this store.
  return { value, increment, decrement };
}
```

You work with stores using the `addStore` and `getStore` hooks. When you add a store to a part of your app, any component inside can now use it.

> Like an umbrella; it provides shade (state) to those under it, but not next to or above it.

```jsx
function App() {
  // Creates one instance of CounterStore and returns it for immediate use.
  const counter = addStore(this, CounterStore);

  return (
    <div>
      {/* Child views inherit context and therefore access to stores above them in the view tree. */}
      <CounterView />
      <button onClick={counter.increment}>Increment</button>
    </div>
  );
}

function CounterView() {
  // Returns the same instance of CounterStore.
  const counter = getStore(this, CounterStore);
  return <p>Current value: {counter.value}</p>;
}
```

### What are stores good for?

- Authentication state
- Caching data between router pages
- Avoiding prop drilling for local state

## Extras

Now that you've seen how to wire up a Dolla app, here are a few things to try:

- Add a [router](./src/router/README.md) to create an SPA
- Add [language translations](./src/translate/README.md) to go international.

---

[🦆 That's a lot of ducks.](https://www.manyducks.co)
