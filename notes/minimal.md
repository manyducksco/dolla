# Concept

I'm finding myself in need of a lightweight, modular reactive template system. I basically want to be able to use just signals and Markup templates in a custom web component, or wherever.

```js
import { signal, memo, html, mount } from "minimal-lib";

const count = signal(0);

const increment = () => count((current) => current + 1);
const decrement = () => count((current) => current - 1);

mount(
  html`
    <p>Counter: ${count}</p>

    <button onclick=${increment}>Increment</button>
    <button onclick=${decrement}>Decrement</button>
  `,
  document.body,
);
```

The above example would create an Accessor function with a count value and some methods to mutate it. It would construct some elements and mount them to `document.body`. When the source value is updated the template will update too.

This is a whole usable API out of the box, and the single Accessor function makes it feasible to store `count` as a property of a web component like so:

```js
class CustomElement extends HTMLElement {
  count = signal(0);

  increment = () => this.count((current) => current + 1);
  decrement = () => this.count((current) => current - 1);

  connectedCallback() {
    const root = this.attachShadow({ mode: "open" });

    mount(
      html`
        <p>Counter: ${this.count}</p>

        <button onclick=${this.increment}>Increment</button>
        <button onclick=${this.decrement}>Decrement</button>
      `,
      root,
    );
  }
}
```

## Other helpers

```js
import { signal, memo, get, peek, html, repeat, show } from "minimal-lib";

const doubled = memo(() => get(count) * 2); // for cases where `count` may not be reactive

peek(count); // peek is the untracked equivalent of `get`

// Render a list with `each`
// each(source, keyFn, renderFn)
const items = track([
  { id: 1, name: "A" },
  { id: 2, name: "B" },
  { id: 3, name: "C" },
]);
html`
  <ul>
    ${repeat(
      items,
      (item) => item.id,
      (item, index) => {
        return html`<li id="${() => item().id + "_" + index()}">${() => item().name}</li>`;
      },
    )}
  </ul>
`;

// Conditionally show based on a tracked condition
// show(condition, whenTruthy, whenFalsy)
html` <div>${show(() => count() > 10, html`<p>That's a lot of clicks.</p>`, html`<p>Not a lot of clicks.</p>`)}</div> `;
```

## Building up

Now, with that base we could build other libraries to extend it in different ways.
