# ATOMIC

- New library; core is just signals, templates and views.
- Router released as companion library.
- Localize released as companion library.
- CSS components as new companion library.

Goals:

- Easy drop-in script tag to get started. Feasible to start with a CDN for prototyping and introduce build step later.
- Server side rendering support. `html` templates should create intermediate data structure that can be turned into DOM nodes or a string.

## Signals

```js
import { atom, memo, createScope, $effect } from "@manyducks.co/atomic";

// Atoms are hybrid getter/setter functions. Call without a value to get, call with a value to set.
const count = atom(0);

// Basic computed properties are just functions. Taking advantage of the fact that functions called in functions will still be tracked.
const doubled = () => count() * 2;

// Use memo to make a memoized value for more expensive calculations.
const quadrupled = memo(() => doubled() * 2);
```

### Scopes

> NOTE: Views and directives are called within a scope.

```js
// Functions starting with $ can be called within a scope.
// Scopes will clean up all effects created within them when they are disconnected.
const scope = createScope(() => {
  $effect(() => {
    // Atoms and memos called within an $effect are automatically tracked.
    console.log(`count is ${count()} (doubled: ${doubled()})`);
  });

  // Changing tracked values will trigger effects to run again.
  count(1);

  // $effects are called immediately once, then again each time one or more dependencies change.
  // Effects are settled in queueMicrotask(), effectively batching them.

  count(2);
  count(3);
  count(4);
  // Multiple synchronous calls in a row like this will only trigger the effect once.
});

// ----- Scope Functions ----- //

$effect(() => {
  // Tracks dependencies. This function will run again when any of them change.
});

$connected(() => {
  // Runs when scope is connected.
  // In views and directives this happens in the next microtask after DOM nodes are attached.
});

$disconnected(() => {
  // Runs when scope is disconnected.
  // In views and directives this happens in the next microtask after DOM nodes are disconnected.
});

// ----- Scope API ----- //

const scope = createScope(() => {
  /* ... */
});

// Connect starts all $effects and runs $connected callbacks.
scope.connect();

// Disconnect disposes all $effects and runs $disconnected callbacks.
scope.disconnect();
```

## Templates

```js
// Provide directives and views in a config object.
const template = html({
  directives: { custom: customDirective },
  views: { SomeView },
})`
  <div>
    <SomeView *custom=${x} prop=${value} />
  </div>
`;

// Or put the views and directives at the end?
const template = html`
  <div>
    <p>Counter: ${count}</p>

    <!-- bind events with @name -->
    <div>
      <button @click=${increment}>+1</button>
      <button @click=${decrement}>-1</button>
    </div>

    <!-- apply directives with *name -->
    <div *ref=${refAtom} *if=${x} *unless=${x} *show=${x} *hide=${x} *classes=${x} *styles=${x} *custom=${whatever} />

    <!-- bind properties with .name -->
    <span .textContent=${x} />

    <!-- two-way bind atoms with :value -->
    <input :value=${valueAtom} />

    <ul *if=${hasValues}>
      <!-- render iterables from signals with list() -->
      ${list(values, (value, index) => {
        // Render views into HTML templates with view()
        return html`<li><SomeView item=${value} /></li>`.withViews({ SomeView });
      })}
    </ul>
  </div>
`
  .withDirectives({ custom: customDirective })
  .withViews({ SomeView });

// Key
// @ for event listeners
// * for directives
// . for properties
// :value for two-way value binding
// no prefix for attributes
```

### Event modifiers

```js
html`<button
  @click.stop.prevent.throttle[250]=${() => {
    // stopPropagation & preventDefault already called
    // Listener will be triggered a maximum of once every 250 milliseconds.
  }}
>
  Click Me
</button>`;
```

You can chain modifiers on event handlers. Inspired by [`Mizu.js`](https://mizu.sh/#event).

#### `.prevent`

Calls event.preventDefault() when triggered.

#### `.stop`

Calls event.stopPropagation() when triggered.

#### `.once`

Register listener with { once: true }. If present the listener is removed after being triggered once.

#### `.passive`

Register listener with { passive: true }.

#### `.capture`

Register listener with { capture: true }.

#### `.self`

Trigger listener only if event.target is the element itself.

#### `.attach[element | window | document]`

> `@click.attach[document]=${...}`

Attach listener to a different target.

#### `.throttle[duration≈250ms]`

Prevent listener from being called more than once during the specified time frame. Duration value is in milliseconds.

#### `.debounce[duration≈250ms]`

Delay listener execution until the specified time frame has passed without any activity. Duration value is in milliseconds.

### Lists

```js
list(values, (value, index) => {
  return html`<li>${view(SomeComponent, value)}</li>`;
});
```

### Custom Directives

```js
function myDirective(element, value, modifiers) {
  // Directives are called inside a scope.
  $disconnected(() => {
    // Cleanup
  });
}
```

## Full Example

```js
import { atom, memo, html, connect, $effect } from "@manyducks.co/atomic";

// Functions starting with $ can only be called in the body of a component function.

// IDEA: CSS components. Ref counted and added to head while used at least once on the page.
const button = css`
  color: "red";

  &:hover {
    color: "blue";
  }
`;

function Counter() {
  const debug = logger("Component");

  const count = atom(0);

  // Simple computed value; computation runs each time function is called
  const doubled = () => count() * 2;

  // Memoized; computation only runs when one of its dependencies changes
  const quadrupled = memo((previousValue) => doubled() * 2, { equals: deepEqual });
  // memos pass their previous to their callback
  // memos can have an equality function specified (as can atoms)

  $effect(() => {
    // Dependencies are tracked when getters are called in a tracked scope.
    // Tracked scopes are the body of a `memo` or `effect` callback.
    debug.log(`Count is: ${count()}`);

    // untrack
    const value = peek(count);
    const doubled = peek(() => {
      return count() * 2;
    });
  });

  $connected(() => {
    // Runs when component is connected.
  });

  $disconnected(() => {
    // Runs when component is disconnected.
  });

  function increment() {
    // Set new value
    count(count() + 1);
  }

  function decrement() {
    count(count() - 1);
  }

  const hasValues = () => values().length > 0;

  return html`
    <div>
      <p>Counter: ${count}</p>
      <div>
        <button @click=${increment}>+1</button>
        <button @click=${decrement}>-1</button>
      </div>

      <div *ref=${refAtom} *if=${x} *unless=${x} *show=${x} *hide=${x} *classes=${x} *styles=${x} *custom=${whatever} />

      <!-- Property binding -->
      <span .textContent=${x} />

      <!-- Two way binding of atoms -->
      <input :value=${valueAtom} />

      <ul *if=${hasValues}>
        ${list(values, (value, index) => {
          return html`<li>${view(SomeComponent, value)}</li>`;
        })}
      </ul>
    </div>
  `.withDirectives({ custom: customDirective });
}

// In another file...

function refDirective(element, fn) {
  fn(element);
  $disconnected(() => {
    fn(undefined);
  });
}

function ifDirective(element, condition) {
  // directives run in microtask immediately after element is attached to parent, before next paint

  const placeholder = document.createComment("");

  // $functions work in directives; they hook into the lifecycle of the element
  $effect(() => {
    if (condition()) {
      // show element
      if (!element.parentNode && placeholder.parentNode) {
        element.insertBefore(placeholder.parentNode);
        placeholder.parentNode.removeChild(placeholder);
      }
    } else {
      // hide element
      if (element.parentNode && !placeholder.parentNode) {
        placeholder.insertBefore(element.parentNode);
        element.parentNode.removeChild(element);
      }
    }
  });
}

function unlessDirective(element, condition) {
  return ifDirective(element, () => !condition());
}

function showDirective(element, condition) {
  // Store the element's current value.
  let value = element.style.display;

  $effect(() => {
    if (condition()) {
      // Apply the stored value when truthy.
      element.style.display = value;
    } else {
      // Store value and hide when falsy.
      value = element.style.display;
      element.style.display = "none !important";
    }
  });
}

function hideDirective(element, condition) {
  return showDirective(element, () => !condition());
}

function classesDirective(element, classes) {
  // TODO: Applies an object of class names and values, where the values may be signals or plain values.
  // Truthy means "apply this class" while falsy means don't.
}

function stylesDirective(element, styles) {
  // TODO: Same idea as *classes but for styles.
}

connect(Component, document.body);

// Easy custom elements? Could be another library.
element("my-counter", function () {
  // Runs just after connectedCallback. `this` is bound to the custom HTMLElement class.
  const shadow = this.attachShadow({ mode: "closed" });

  return html`<div></div>`;
});

// function css(strings, values) {
//   return {
//     type: "css",

//   }
// }
```

```ts
interface TemplateNode {
  mount(parent: Node, after?: Node): void;
  unmount(skipDOM?: boolean): void;
}

interface TemplateDirective {
  (element: Element, value: unknown): Node | TemplateNode;
}
```
