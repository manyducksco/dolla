# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

> WARNING: This package is in active development. It may contain serious bugs and releases may introduce breaking changes without notice.

Dolla is a batteries-included JavaScript frontend framework covering the needs of moderate-to-complex single page apps:

- Reactive DOM updates (Signals)
- Reusable components (Views)
- Routing
- HTTP client
- Localization (translations as JSON files and a `t` function to get strings)

Let's first get into some examples.

## Signals

### Signals API

```jsx
import { createSignal, derive } from "@manyducks.co/dolla";

// Create a readable state and setter.
const [$count, setCount] = createSignal(0);

// Derive a new state from one or more states.
const $doubled = derive([$$count], (count) => count * 2);
```

### Basic State

```jsx
import { createSignal } from "@manyducks.co/dolla";

const [$count, setCount] = createSignal(0);

// Set Style 1: Set value explicitly.
setCount(1); // $count = 1

// Set Style 2: Set value based on the current value using a callback.
const increment = () => setCount((current) => current + 1);
const decrement = () => setCount((current) => current - 1);

increment(); // $count = 2
increment(); // $count = 3
decrement(); // $count = 2

console.log($count.get()); // 2
```

### Derived State

```jsx
import { createSignal, derive } from "@manyducks.co/dolla";

const [$count, setCount] = createSignal(0);
const $doubled = derive([$count], (count) => count * 2);

setCount(1); // $count = 1, $doubled = 2
setCount(256); // $count = 256, $doubled = 512
setCount(-37); // $count = -37, $doubled = -74
```

## A Basic View

```js
import Dolla, { html } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const [$count, setCount] = Dolla.createSignal(0);

  function increment() {
    setCount((count) => count + 1);
  }

  return html`
    <div>
      <p>Clicks: ${$count}</p>
      <button onclick=${increment}>Click here to increment</button>
    </div>
  `;
}

Dolla.mount(document.body, Counter);
```

The above example, annotated:

```js
import Dolla, { html } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const [$count, setCount] = Dolla.createSignal(0);

  function increment() {
    setCount((count) => count + 1);
  }

  return html`
    <div>
      <p>Clicks: ${$count}</p>
      <button onclick=${increment}>Click here to increment</button>
    </div>
  `;
}

Dolla.mount(document.body, Counter);
```

Localized:

```js
import Dolla, { html, t } from "@manyducks.co/dolla";

function Counter(props, ctx) {
  const [$count, setCount] = Dolla.createSignal(0);

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

If you've ever used React before (and chances are you have if you're interested in obscure frameworks like this one) this should look very familiar to you.

The biggest difference is that the Counter function runs only once when the component is mounted. All updates after that point are a direct result of the `$count` signal being updated.

## Advanced Componentry

Component functions take two arguments; props and a `Context` object. Props are passed from parent components to child components, and `Context` is provided by the app.

> The following examples are shown in TypeScript for clarity. Feel free to omit the type annotations in your own code if you prefer vanilla JS.

### Props

Props are values passed down from parent components. These can be static values, signals, callbacks and anything else the child component needs to do its job.

```tsx
import { type Signal, type Context, html } from "@manyducks.co/dolla";

type HeadingProps = {
  $text: Signal<string>;
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
import { type Signal, type Context, html } from "@manyducks.co/dolla";

type HeadingProps = {
  $text: Signal<string>;
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

  // Signals can be watched by the component context.
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
import { signal, proxy } from "@manyducks.co/dolla";

const [$names, setNames] = signal(["Morg", "Ton", "Bon"]);
const [$index, setIndex] = signal(0);

const [$selected, setSelected] = proxy([$names, $index], {
  get(names, index) {
    return names[index];
  },
  set(next) {
    const index = $names.get().indexOf(next);
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

##

States come in two varieties, each with a constructor function and a TypeScript type to match. These are:

- `Readable<T>`, which has only a `.get()` method that returns the current value.
- `Writable<T>`, which extends `Readable<T>` and adds a couple methods:
  - `.set(value: T)` to replace the stored value.
  - `.update(callback: (current: T) => T)` which takes a function that receives the current value and returns a new one.

The constructor functions are `$` for `Readable` and `$$` for `Writable`. By convention, the names of each are prefixed with `$` or `$$` to indicate its type, making the data flow a lot easier to understand at a glance.

```js
import { signal } from "@manyducks.co/dolla";

// By convention, Writable names are prefixed with two dollar signs and Readable with one.
const [$number, setNumber] = signal(5);

// Returns the current value held by the Writable.
$number.get();
// Stores a new value to the Writable.
setNumber(12);
// Uses a callback to update the value. Takes the current value and returns the next.
setNumber((current) => current + 1);

// Derive a new state from an existing one.
const $doubled = derive([$number], (value) => value * 2);
$doubled.get(); // 26 ($number is 13)

// Derive one new state from the latest values of many other states.
const $many = derive([$number, $doubled], (num, doubled) => num + doubled);
```

Now how do we use it? For a real example, a simple greeter app. The user types their name into a text input and that value is reflected in a heading above the input. For this we will use the `writable` function to create a state container. That container can be slotted into our JSX as a text node or DOM property. Any changes to the value will now be reflected in the DOM.

```jsx
import { signal } from "@manyducks.co/dolla";

function Greeter() {
  const [$name, setName] = signal("Valued Customer");

  return (
    <section>
      <header>
        <h1>Hello, {$name}!</h1>
      </header>

      <input
        value={$name}
        onChange={(e) => {
          setName(e.target.value);
        }}
      />
    </section>
  );
}
```

### Computed

Computed states take one or more Readables or Writables and produce a new value _computed_ from those.

```js
import { $, $$ } from "@manyducks.co/dolla";

const $$count = $$(100);

const $double = $($$count, (value) => value * 2);
```

In that example, `$$double` will always have a value derived from that of `$$count`.

Let's look at a more typical example where we're basically joining two pieces of data; a list of users and the ID of the selected user.

```js
import { $, $$ } from "@manyducks.co/dolla";

// Let's assume this list of users was fetched from an API somewhere.
const $$people = $$([
  {
    id: 1,
    name: "Borb",
  },
  {
    id: 2,
    name: "Bex",
  },
  {
    id: 3,
    name: "Bleeblop",
  },
]);

// Let's assume this ID was chosen from an input where the above users were displayed.
const $$selectedId = $$(2);

// Now we get the object of the person who is selected.
const $selectedPerson = $($$people, $$selectedId, (people, selectedId) => {
  return people.find((person) => person.id === selectedId);
});

// Now we get a Readable of just that person's name. Say we're going to display it on the page somewhere.
const $personName = $($selectedPerson, (person) => person.name);

console.log($personName.get()); // "Bex"
```

Notice that the structure above composes a data pipeline; if any of the data changes, so do the computed values, but the relationship between the data remains the same. Now that we've defined these relationships, `$selectedPerson` is always the person pointed to by `$$selectedId`. `$personName` is always the name of `$selectedPerson`, etc.

### Unwrap

The `unwrap` function returns the current value of a Readable or Writable, or if passed a non-Readable value returns that exact value. This function is used to guarantee you have a plain value when you may be dealing with either a container or a plain value.

```js
import { $, $$, unwrap } from "@manyducks.co/dolla";

const $$number = $$(5);

unwrap($$number); // 5
unwrap($(5)); // 5
unwrap(5); // 5
```

### Advanced Use Cases

<details>
  <summary><code>observe</code> and <code>proxy</code></summary>

> TO DO

</details>

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
  const $items = $(["Squirrel", "Chipmunk", "Groundhog"]);

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
  return portal(content, document.body);
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

#### Using Stores

```jsx
import { UserStore } from "../stores/UserStore.js";

function ExampleView(props, ctx) {
  const { $name } = ctx.getStore(UserStore);

  return <h1>Hello {$name}!</h1>;
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

#### Example: Counter View

Putting it all together, we have a view that maintains a counter. The user sees the current count displayed, and below it three buttons; one to increment by 1, one to decrement by 1, and one to reset the value to 0.

```jsx
import { $$ } from "@manyducks.co/dolla";

function CounterView(props, ctx) {
  const $$count = $$(0);

  function increment() {
    $$count.update((n) => n + 1);
  }

  function decrement() {
    $$count.update((n) => n - 1);
  }

  function reset() {
    $$count.set(0);
  }

  return (
    <div>
      <p>The count is {$$count}</p>
      <div>
        <button onClick={increment}>+1</button>
        <button onClick={decrement}>-1</button>
        <button onClick={reset}>Reset</button>
      </div>
    </div>
  );
}
```

## Stores

A store is a function that returns a plain JavaScript object. If this store is registered on the app, a single instance of the store is shared across all views and stores in the app. If the store is registered using a `StoreScope`, a single instance of the store is shared amongst all child elements of that `StoreScope`.

Stores are accessed with the `getStore` function available on the context object in views and other stores.

Stores are helpful for managing persistent state that needs to be accessed in many places.

```js
import { App } from "@manyducks.co/dolla";

const app = App({
  view: LayoutView,
  stores: [MessageStore],
});

// We define a store that just exports a message.
function MessageStore() {
  return {
    message: "Hello from the message store!",
  };
}

// All instances of MessageView will share just one instance of MessageStore.
function MessageView(props, ctx) {
  const store = ctx.getStore(MessageStore);

  return <p>{store.message}</p>;
}

// And a layout view with five MessageViews inside.
function LayoutView() {
  return (
    <div>
      <h1>Title</h1>
      <MessageView />
      <MessageView />
      <MessageView />
      <MessageView />
      <MessageView />
    </div>
  );
}

// Connect the app.
app.connect("#app");
```

The output:

```html
<div id="app">
  <div>
    <h1>Title</h1>
    <p>Hello from the message store!</p>
    <p>Hello from the message store!</p>
    <p>Hello from the message store!</p>
    <p>Hello from the message store!</p>
    <p>Hello from the message store!</p>
  </div>
</div>
```

### StoreScope

Stores relevant to only a part of the view tree can be scoped using a `StoreScope`.

```jsx
function ExampleStore() {
  return { value: 5 };
}

function ExampleView(props, ctx) {
  const store = ctx.getStore(ExampleStore);

  return <div>{store.value}</div>;
}

function LayoutView() {
  return (
    <StoreScope stores={[ExampleStore]}>
      <ExampleView />
    </StoreScope>
  );
}
```

## Apps and Routing

```jsx
import { App } from "@manyducks.co/dolla";

const app = App({
  // Debug options control what gets printed from messages logged through view and store contexts.
  debug: {
    // A comma-separated list of filters. '*' means allow everything and '-dolla/*' means suppress messages with labels beginning with 'dolla/'.
    filter: "*,-dolla/*",

    // Never print ctx.info() messages
    info: false,

    // Only print ctx.log() and ctx.warn() messages in development mode
    log: "development",
    warn: "development",

    // Always print ctx.error() messages
    error: true,
  },

  mode: "development", // or "production" (enables additional debug features and logging in "development")

  view: (_, ctx) => {
    // Define a custom root view. By default this just renders any routes like so:
    return ctx.outlet();
  },
});
```

#### Routes and Outlets

The main view (defined with the app's `main` method) is the top-level view that will always be displayed while the app is connected.

```jsx
// Here is an app with a hypothetical main view with a layout and navigation:
const app = App({
  view: (_, ctx) => {
    return (
      <div class="todo-layout">
        <nav>
          <ul>
            <li>
              <a href="/tasks">Tasks</a>
            </li>
            <li>
              <a href="/completed">Completed</a>
            </li>
          </ul>
        </nav>
        {/*
         * An outlet is where children of a view are shown.
         * Because this is a main view, children in this case
         * are the views that correspond to matched routes.
         */}
        {ctx.outlet()}
      </div>
    );
  },

  stores: [
    {
      store: RouterStore,
      options: {
        hash: true, // Use hash-based routing (default false)

        // Here are a couple of routes to be rendered into our layout:
        routes: [
          { path: "/tasks", view: TasksView },
          { path: "/completed", view: CompletedView },
        ],
      },
    },
  ],
});
```

Routes can also be nested. Just like the main view and its routes, subroutes will be displayed in the outlet of their parent view.

```jsx
const app = App({
  stores: [
    {
      store: RouterStore,
      options: {
        routes: [
          {
            path: "/tasks",
            view: TasksView,
            routes: [
              { path: "/", view: TaskListView },

              // In routes, `{value}` is a dynamic value that matches anything,
              // and `{#value}` is a dynamic value that matches a number.
              { path: "/{#id}", view: TaskDetailsView },
              { path: "/{#id}/edit", view: TaskEditView },

              // If the route is any other than the ones defined above, redirect to the list.
              // Redirects support './' and '../' style relative paths.
              { path: "*", redirect: "./" },
            ],
          },
          { path: "/completed", view: CompletedView },
        ],
      },
    },
  ],
});
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
import { App, RouterStore } from "@manyducks.co/dolla";
import { PersonDetails, ThingIndex, ThingDetails, ThingEdit, ThingDelete } from "./components.js";

const app = App({
  stores: [
    {
      store: RouterStore,
      options: {
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
      },
    },
  ],
});
```

As you may have inferred from the code above, when the URL matches a pattern the corresponding view is displayed. If we
visit `/people/john`, we will see the `PersonDetails` view and the params will be `{ name: "john" }`. Params can be
accessed inside those views through `RouterStore`.

```js
function PersonDetails(props, ctx) {
  // `router` store allows you to work with the router from inside the app.
  const router = ctx.getStore(RouterStore);

  // Info about the current route is exported as a set of Readables. Query params are also Writable through $$query:
  const { $path, $pattern, $params, $$query } = router;

  // Functions are exported for navigation:
  const { back, forward, navigate } = router;

  back(); // Step back in the history to the previous route, if any.
  back(2); // Hit the back button twice.

  forward(); // Step forward in the history to the next route, if any.
  forward(4); // Hit the forward button 4 times.

  navigate("/things/152"); // Navigate to another path within the same app.
  navigate("https://www.example.com/another/site"); // Navigate to another domain entirely.

  // Three ways to confirm with the user that they wish to navigate before actually doing it.
  navigate("/another/page", { prompt: true });
  navigate("/another/page", { prompt: "Are you sure you want to leave and go to /another/page?" });
  navigate("/another/page", { prompt: PromptView });

  // Get the live value of `{name}` from the current path.
  const $name = computed($params, (p) => p.name);

  // Render it into a <p> tag. The name portion will update if the URL changes.
  return <p>The person is: {$name}</p>;
}
```

---

[🦆](https://www.manyducks.co)
