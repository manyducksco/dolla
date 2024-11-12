# Scratch Note

```tsx
// import { signal, computed } from "@manyducks.co/dolla";

function signal(initialValue, options = {}) {}

function computed();

function WhateverView(props, c) {
  // IDEA: Have state, computed and effect be methods on the view context.
  // PROBLEM: Then what are the types when passing as props? State? ComputedState? or just a generic Dynamic<T> for readable/writable?

  // Context variables (replacement for stores)
  c.set("name", {
    value: 5,
  });

  // Can get in the same context scope or on a child.
  // Throws an error if value is not set.
  c.get("name");

  // If we use this $readable and set function pattern then we only have a single type of signal which is read-only.
  // Take props as Signal<T> and deal with setting in callbacks. Simple and predictable.
  const [$count, setCount] = signal(5);

  const $doubled = derived($count, (value) => value * 2);

  // const watcher = new SignalWatcher($count, (value) => {
  //   c.debug.log("watcher received value: " + value);
  // });

  // watcher.start();
  // watcher.stop();

  $count.get(); // returns the current value
  setCount(10); // updates the value

  // Observe and trigger side effects.
  c.watch($count, (count) => {
    c.debug.log(`The value of count is: ${count}`);
  });

  // Exposes language and translation tools.
  c.i18n.translate$("");
  c.i18n.$language;
  c.i18n.setLanguage();

  // Exposes internal HTTP client.
  c.http.get(); // put, post, patch, delete, etc.

  // Exposes router helpers and variables.
  c.route.go("/");
  c.route.$params;
  c.route.$path;
  c.route.$query;
  c.route.setQuery({
    value: 1,
  });

  return html`
    <h1>This is the template</h1>

    ${render($count, (count) => {
      // Render rebuilds the markup within when any of the dependencies change.
      return html`<p>The count is ${count}</p>`;

      // Other view helpers are also provided as exports
      repeat();
      cond();
      outlet();
      portal();
    })}
  `;
}
```
