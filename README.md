# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

> WARNING: This package is in active development. It may contain serious bugs and docs may be outdated or inaccurate. Use at your own risk.

Dolla is a batteries-included JavaScript frontend framework covering the needs of moderate-to-complex single page apps:

- ⚡ Reactive DOM updates with [State](). Inspired by Signals, but with more explicit tracking.
- 📦 Reusable components with [Views](#section-views).
- 🔀 Built in [routing]() with nested routes and middleware support (check login status, preload data, etc).
- 🐕 Built in [HTTP]() client with middleware support (set auth headers, etc).
- 📍 Built in [localization]() system (store translated strings in JSON files and call the `t` function to get them).
- 🍳 Build system optional. Write views in JSX or use `html` tagged template literals.

Let's first get into some examples.

## State

### Basic State API

```jsx
import { createState, toState, valueOf, derive } from "@manyducks.co/dolla";

const [$count, setCount] = createState(72);

// Get value
$count.get(): // 72

// Replace the stored value with something else
setCount(300);
$count.get(); // 300

// You can also pass a function that takes the current value and returns a new one
setCount((current) => current + 1);
$count.get(); // 301

// Watch for changes to the value
const unwatch = $count.watch((value) => {
  // This function is called immediately with the current value, then again each time the value changes.
});
unwatch(); // Stop watching for changes

// Returns the value of a state. If the value is not a state it is returned as is.
const count = valueOf($count);
const bool = valueOf(true);

// Creates a state from a value. If the value is already a state it is returned as is.
const $bool = toState(true);
const $anotherCount = toState($count);

// Derive a new state from one or more other states. Whenever $count changes, $doubled will follow.
const $doubled = derive([$count], (count) => count * 2);
const $sum = derive([$count, $doubled], (count, doubled) => count + doubled);
```

States also come in a settable variety that includes the setter on the same object. Sometimes you want to pass around a two-way binding and this is what SettableState is for.

```jsx
import { createSettableState, fromSettable, toSettable } from "@manyducks.co/dolla";

// Settable states have their setter included.
const $$value = createSettableState("Test");
$$value.set("New Value");

// They can also be split into a State and Setter
const [$value, setValue] = fromSettableState($$value);

// And a State and Setter can be combined into a SettableState.
const $$otherValue = toSettableState($value, setValue);

// Or discard the setter and make it read-only using the good old toState function:
const $value = toState($$value);
```

You can also do weird proxy things like this:

```jsx
// Create an original place for the state to live
const [$value, setValue] = createState(5);

// Derive a state that doubles the value
const $doubled = derive([$value], (value) => value * 2);

// Create a setter that takes the doubled value and sets the original $value accordingly.
const setDoubled = createSetter($doubled, (next, current) => {
  setValue(next / 2);
});

// Bundle the derived state and setter into a SettableState to pass around.
const $$doubled = toSettableState($doubled, setDoubled);

// Setting the doubled state...
$$doubled.set(100);

// ... will be reflected everywhere.
$$doubled.get(); // 100
$doubled.get(); // 100
$value.get(); // 50
```

## Views [id="section-views"]

A basic view:

```js
import Dolla, { createState, html } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const [$count, setCount] = createState(0);

  function increment() {
    setCount((count) => count + 1);
  }

  return html`
    <div>
      <p>Clicks: ${$count}</p>
      <button onclick=${increment}>+1</button>
    </div>
  `;
}

Dolla.mount(document.body, Counter);
```

If you've ever used React before (and chances are you have if you're interested in obscure frameworks like this one) this should look very familiar to you.

The biggest difference is that the Counter function runs only once when the component is mounted. All updates after that point are a direct result of `$count` being updated.

## Advanced Componentry

Component functions take two arguments; props and a `Context` object. Props are passed from parent components to child components, and `Context` is provided by the app.

> The following examples are shown in TypeScript for clarity. Feel free to omit the type annotations in your own code if you prefer vanilla JS.

### Props

Props are values passed down from parent components. These can be static values, signals, callbacks and anything else the child component needs to do its job.

```tsx
import { type State, type Context, html } from "@manyducks.co/dolla";

type HeadingProps = {
  $text: State<string>;
};

function Heading(props: HeadingProps, c: Context) {
  return html`<h1>${props.$text}</h1>`;
}

function Layout() {
  const [$text, setText] = signal("HELLO THERE!");

  return (
    <section>
      <Heading $text={$text}>
    </section>
  );
}
```

### Context

```tsx
import { type State, type Context, html } from "@manyducks.co/dolla";

type HeadingProps = {
  $text: State<string>;
};

function Heading(props: HeadingProps, c: Context) {
  // A full compliment of logging functions:
  // Log levels that get printed can be set at the app level.

  c.trace("What's going on? Let's find out.");
  c.info("This is low priority info.");
  c.log("This is normal priority info.");
  c.warn("Hey! This could be serious.");
  c.error("NOT GOOD! DEFINITELY NOT GOOD!!1");

  // And sometimes things are just too borked to press on:
  c.crash(new Error("STOP THE PRESSES! BURN IT ALL DOWN!!!"));

  // The four lifecycle hooks:

  // c.beforeMount(() => {
  //   c.info("Heading is going to be mounted. Good time to set things up.");
  // });

  c.onMount(() => {
    c.info("Heading has just been mounted. Good time to access the DOM and finalize setup.");
  });

  // c.beforeUnmount(() => {
  //   c.info("Heading is going to be unmounted. Good time to begin teardown.");
  // });

  c.onUnmount(() => {
    c.info("Heading has just been unmounted. Good time to finalize teardown.");
  });

  // States can be watched by the component context.
  // Watchers created this way are cleaned up automatically when the component unmounts.

  c.watch(props.$text, (value) => {
    c.warn(`text has changed to: ${value}`);
  });

  return html`<h1>${props.$text}</h1>`;
}
```

## Signals

Basics

```jsx
const [$count, setCount] = signal(0);

// Set the value directly.
setCount(1);
setCount(2);

// Transform the previous value into a new one.
setCount((current) => current + 1);

// This can be used to create easy helper functions:
function increment(amount = 1) {
  setCount((current) => current + amount);
}
increment();
increment(5);
increment(-362);

// Get the current value
$count.get(); // -354

// Watch for new values. Don't forget to call stop() to clean up!
const stop = $count.watch((current) => {
  console.log(`count is now ${current}`);
});

increment(); // "count is now -353"
increment(); // "count is now -352"

stop();
```

Derive

```jsx
import { signal, derive } from "@manyducks.co/dolla";

const [$names, setNames] = signal(["Morg", "Ton", "Bon"]);
const [$index, setIndex] = signal(0);

// Create a new signal that depends on two existing signals:
const $selected = derive([$names, $index], (names, index) => names[index]);

$selected.get(); // "Morg"

setIndex(2);

$selected.get(); // "Bon"
```

Proxy

```jsx
import { createState, createProxyState } from "@manyducks.co/dolla";

const [$names, setNames] = createState(["Morg", "Ton", "Bon"]);
const [$index, setIndex] = createState(0);

const [$selected, setSelected] = createProxyState([$names, $index], {
  get(names, index) {
    return names[index];
  },
  set(next, names, _) {
    const index = names.indexOf(next);
    if (index === -1) {
      throw new Error("Name is not in the list!");
    }
    setIndex(index);
  },
});

$selected.get(); // "Morg"
$index.get(); // 0

// Set selected directly by name through the proxy.
setSelected("Ton");

// Selected and the index have been updated to match.
$selected.get(); // "Ton"
$index.get(); // 1
```

## Views

Views are what most frameworks would call Components. Dolla calls them Views because they deal specifically with stuff the user sees, and because Dolla also has another type of component called Stores that share data between views. We will get into those later.

At its most basic, a view is a function that returns elements.

```jsx
function ExampleView() {
  return <h1>Hello World!</h1>;
}
```

#### View Props

A view function takes a `props` object as its first argument. This object contains all properties passed to the view when it's invoked.

```js
import { html } from "@manyducks.co/dolla";

function ListView(props, ctx) {
  return html`
    <ul>
      <${ListItemView} label="Squirrel" />
      <${ListItemView} label="Chipmunk" />
      <${ListItemView} label="Groundhog" />
    </ul>
  `;
}

function ListItemView(props, ctx) {
  return html`<li>${props.label}</li>`;
}
```

```jsx
function ListView() {
  return (
    <ul>
      <ListItemView label="Squirrel" />
      <ListItemView label="Chipmunk" />
      <ListItemView label="Groundhog" />
    </ul>
  );
}

function ListItemView(props) {
  return <li>{props.label}</li>;
}
```

As you may have guessed, you can pass States as props and slot them in in exactly the same way. This is important because Views do not re-render the way you might expect from other frameworks. Whatever you pass as props is what the View gets for its entire lifecycle.

### View Helpers

#### `cond($condition, whenTruthy, whenFalsy)`

The `cond` helper does conditional rendering. When `$condition` is truthy, the second argument is rendered. When `$condition` is falsy the third argument is rendered. Either case can be left null or undefined if you don't want to render something for that condition.

```jsx
function ConditionalListView({ $show }) {
  return (
    <div>
      {cond(
        $show,

        // Visible when truthy
        <ul>
          <ListItemView label="Squirrel" />
          <ListItemView label="Chipmunk" />
          <ListItemView label="Groundhog" />
        </ul>,

        // Visible when falsy
        <span>List is hidden</span>,
      )}
    </div>
  );
}
```

#### `repeat($items, keyFn, renderFn)`

The `repeat` helper repeats a render function for each item in a list. The `keyFn` takes an item's value and returns a number, string or Symbol that uniquely identifies that list item. If `$items` changes or gets reordered, all rendered items with matching keys will be reused, those no longer in the list will be removed and those that didn't previously have a matching key are created.

```jsx
function RepeatedListView() {
  const $items = Dolla.toState(["Squirrel", "Chipmunk", "Groundhog"]);

  return (
    <ul>
      {repeat(
        $items,
        (item) => item, // Using the string itself as the key
        ($item, $index, ctx) => {
          return <ListItemView label={$item} />;
        },
      )}
    </ul>
  );
}
```

#### `portal(content, parentNode)`

The `portal` helper displays DOM elements from a view as children of a parent element elsewhere in the document. Portals are typically used to display modals and other content that needs to appear at the top level of a document.

```jsx
function PortalView() {
  const content = (
    <div class="modal">
      <p>This is a modal.</p>
    </div>
  );

  // Content will be appended to `document.body` while this view is connected.
  return portal(document.body, content);
}
```

### View Context

A view function takes a context object as its second argument. The context provides a set of functions you can use to respond to lifecycle events, observe dynamic data, print debug messages and display child elements among other things.

#### Printing Debug Messages

```jsx
function ExampleView(props, ctx) {
  // Set the name of this view's context. Console messages are prefixed with name.
  ctx.name = "CustomName";

  // Print messages to the console. These are suppressed by default in the app's "production" mode.
  // You can also change which of these are printed and filter messages from certain contexts in the `createApp` options object.
  ctx.info("Verbose debugging info that might be useful to know");
  ctx.log("Standard messages");
  ctx.warn("Something bad might be happening");
  ctx.error("Uh oh!");

  // If you encounter a bad enough situation, you can halt and disconnect the entire app.
  ctx.crash(new Error("BOOM"));

  return <h1>Hello World!</h1>;
}
```

#### Lifecycle Events

```jsx
function ExampleView(props, ctx) {
  ctx.beforeConnect(() => {
    // Do something before this view's DOM nodes are created.
  });

  ctx.onConnected(() => {
    // Do something immediately after this view is connected to the DOM.
  });

  ctx.beforeDisconnect(() => {
    // Do something before removing this view from the DOM.
  });

  ctx.onDisconnected(() => {
    // Do some cleanup after this view is disconnected from the DOM.
  });

  return <h1>Hello World!</h1>;
}
```

#### Displaying Children

The context object has an `outlet` function that can be used to display children at a location of your choosing.

```js
function LayoutView(props, ctx) {
  return (
    <div className="layout">
      <OtherView />
      <div className="content">{ctx.outlet()}</div>
    </div>
  );
}

function ExampleView() {
  // <h1> and <p> are displayed inside LayoutView's outlet.
  return (
    <LayoutView>
      <h1>Hello</h1>
      <p>This is inside the box.</p>
    </LayoutView>
  );
}
```

#### Observing States

The `observe` function starts observing when the view is connected and stops when disconnected. This takes care of cleaning up observers so you don't have to worry about memory leaks.

```jsx
function ExampleView(props, ctx) {
  const { $someValue } = ctx.getStore(SomeStore);

  ctx.observe($someValue, (value) => {
    ctx.log("someValue is now", value);
  });

  return <h1>Hello World!</h1>;
}
```

#### Routing

Dolla makes heavy use of client-side routing. You can define as many routes as you have views, and the URL
will determine which one the app shows at any given time. By building an app around routes, lots of things one expects
from a web app will just work; back and forward buttons, sharable URLs, bookmarks, etc.

Routes are matched by highest specificity regardless of the order they were registered.
This avoids some confusing situations that come up with order-based routers like that of `express`.
On the other hand, order-based routers can support regular expressions as patterns which Dolla's router cannot.

#### Route Patterns

Routes are defined with strings called patterns. A pattern defines the shape the URL path must match, with special
placeholders for variables that appear within the route. Values matched by those placeholders are parsed out and exposed
to your code (`router` store, `$params` readable). Below are some examples of patterns and how they work.

- Static: `/this/is/static` has no params and will match only when the route is exactly `/this/is/static`.
- Numeric params: `/users/{#id}/edit` has the named param `{#id}` which matches numbers only, such as `123` or `52`. The
  resulting value will be parsed as a number.
- Generic params: `/users/{name}` has the named param `{name}` which matches anything in that position in the path. The
  resulting value will be a string.
- Wildcard: `/users/*` will match anything beginning with `/users` and store everything after that in params
  as `wildcard`. `*` is valid only at the end of a route.

Now, here are some route examples in the context of an app:

```js
import Dolla from "@manyducks.co/dolla";
import { PersonDetails, ThingIndex, ThingDetails, ThingEdit, ThingDelete } from "./views.js";

Dolla.router.setup({
  routes: [
    { path: "/people/{name}", view: PersonDetails },
    {
      // A `null` component with subroutes acts as a namespace for those subroutes.
      // Passing a view instead of `null` results in subroutes being rendered inside that view wherever `ctx.outlet()` is called.
      path: "/things",
      view: null,
      routes: [
        { path: "/", view: ThingIndex }, // matches `/things`
        { path: "/{#id}", view: ThingDetails }, // matches `/things/{#id}`
        { path: "/{#id}/edit", view: ThingEdit }, // matches `/things/{#id}/edit`
        { path: "/{#id}/delete", view: ThingDelete }, // matches `/things/{#id}/delete`
      ],
    },
  ],
});
```

As you may have inferred from the code above, when the URL matches a pattern the corresponding view is displayed. If we
visit `/people/john`, we will see the `PersonDetails` view and the params will be `{ name: "john" }`. Params can be
accessed anywhere through `Dolla.router`.

```js
function PersonDetails(props, ctx) {
  // Info about the current route is exported as a set of Readables. Query params are also Writable through $$query:
  const { $path, $pattern, $params, $query } = Dolla.router;

  Dolla.router.back(); // Step back in the history to the previous route, if any.
  Dolla.router.back(2); // Hit the back button twice.

  Dolla.router.forward(); // Step forward in the history to the next route, if any.
  Dolla.router.forward(4); // Hit the forward button 4 times.

  Dolla.router.go("/things/152"); // Navigate to another path within the same app.
  Dolla.router.go("https://www.example.com/another/site"); // Navigate to another domain entirely.

  // Three ways to confirm with the user that they wish to navigate before actually doing it.
  Dolla.router.go("/another/page", { prompt: true });
  Dolla.router.go("/another/page", { prompt: "Are you sure you want to leave and go to /another/page?" });
  Dolla.router.go("/another/page", { prompt: PromptView });

  // Get the live value of `{name}` from the current path.
  const $name = Dolla.derive([$params], (p) => p.name);

  // Render it into a <p> tag. The name portion will update if the URL changes.
  return <p>The person is: {$name}</p>;
}
```

## HTTP Client

```js
// Middleware!
Dolla.http.use((request, next) => {
  // Add auth header for all requests going to the API.
  if (request.url.pathname.startsWith("/api")) {
    request.headers.set("authorization", `Bearer ${authToken}`);
  }

  const response = await next();

  // Could do something with the response here.

  return response;
});

const exampleResponse = await Dolla.http.get("/api/example");

// Body is already parsed from JSON into an object.
exampleResponse.body.someValue;
```

## Localization

```js
import Dolla, { html, t } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const [$count, setCount] = Dolla.createState(0);

  function increment() {
    setCount((count) => count + 1);
  }

  return html`
    <div>
      <p>Clicks: ${$count}</p>
      <button onclick=${increment}>${t("buttonLabel")}</button>
    </div>
  `;
}

Dolla.language.setup({
  initialLanguage: "en",
  languages: [
    { name: "en", strings: { buttonLabel: "Click here to increment" } },
    { name: "ja", strings: { buttonLabel: "ここに押して増加する" } },
  ],
});

Dolla.mount(document.body, Counter);
```

---

[🦆](https://www.manyducks.co)
