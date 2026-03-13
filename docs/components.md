# Components

A component is a function that takes a props object as its first argument and a Context as its second. The context is also bound to `this` inside the function body.

There are two types of functions; Views for rendering DOM nodes and Stores for sharing state and logic between many views.

## Views

```js
function ExampleView(props) {
  return html`
    <section>
      <header>
        <h2>${props.title}</h2>
      </header>
      <article>${props.children}</article>
    </section>
  `;
}
```

## Stores

```js
function ExampleStore(props) {
  const count = state(props.initialCount ?? 0);

  const increment = (amount = 1) => count((current) => current + amount);
  const decrement = (amount = 1) => count((current) => current - amount);
  const reset = () => count(0);

  return {
    count: () => count(),
    increment,
    decrement,
    reset,
  };
}

function ExampleView(props) {
  // Pass context, store, and props.
  const store = addStore(this, ExampleStore, { initialCount: 12 });

  // The instance is returned in case you need to access it in the same view it's attached to.
  onEffect(this, () => {
    console.log("count is:", store.count());
  });

  return html`
    <main>
      <${Counter} />
      <${Counter} />
      <${Counter} />
    </main>
  `;
}

function Counter(props) {
  // A shared instance is now accessible to child views.
  const store = useStore(this, ExampleStore);

  return html`
    <p>Count is: ${store.count}</p>

    <button onclick=${store.increment}>Increment</button>
    <button onclick=${store.decrement}>Decrement</button>
    <button onclick=${store.reset}>Reset</button>
  `;
}
```
