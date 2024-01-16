# 🖥 @manyducks.co/dolla

![bundle size](https://img.shields.io/bundlephobia/min/@manyducks.co/dolla)
![bundle size](https://img.shields.io/bundlephobia/minzip/@manyducks.co/dolla)

> WARNING: This package is pre-1.0 and therefore may contain serious bugs and releases may introduce breaking changes without notice.

Dolla is a frontend framework that covers the common needs of complex apps, such as routing, components and state management. Where Dolla differs from other frameworks is in its approach to state management and how state changes translate to DOM updates.

Dolla gives you a set of composable state container primitives. Everything that happens in your app is a direct result of a value changing inside one of these containers. There is no VDOM. There is no other way to make the app function than to use these containers correctly. However, the advantage is that state, transformations and their side effects are expressed right in front of your eyes rather than being hidden deep in the framework. It's a bit more work to understand up front, but when you do the whole app becomes easier to understand and maintain.

Let's first get into some examples.

## State

### Writables

Writables have a few methods:

```js
const $$number = writable(5);

// Returns the current value held by the Writable.
$$number.get();

// Stores a new value to the Writable.
$$number.set(12);

// Uses a callback to update the value. Takes the current value and returns the next.
$$number.update((current) => current + 1);
```

For the first example, a simple greeter app. The user types their name into a text input and that value is reflected in a heading above the input. For this we will use the `writable` function to create a state container. That container can be slotted into our JSX as a text node or DOM property. Any changes to the value will now be reflected in the DOM.

```jsx
import { writable } from "@manyducks.co/dolla";

function UserView() {
  // By convention writables start with '$$'
  const $$name = writable("Valued Customer");

  return (
    <section>
      <header>
        <h1>Hello, {$$name}!</h1>
      </header>

      <input
        value={$$name}
        onChange={(e) => {
          $$name.set(e.target.value);
        }}
      />
    </section>
  );
}
```

### Readables

Readables are like Writables with only a `get` function. Typically, readables are derived from a Writable or derived from other states with `computed`.

```js
import { writable, readable } from "@manyducks.co/dolla";

const $$value = writable("This is the value.");

// By convention Readable names start with '$'.
const $value = readable($$value);
```

You can now safely pass `$value` around without worrying about that code changing it. `$value` will always reflect the value of `$$value`.

### Computed

Computed states take one or more Readables or Writables and produce a new value _computed_ from those.

```js
import { writable, computed } from "@manyducks.co/dolla";

const $$count = writable(100);

const $double = computed($$count, (value) => value * 2);
```

In that example, `$$double` will always have a value derived from that of `$$count`.

Let's look at a more typical example where we're basically joining two pieces of data; a list of users and the ID of the selected user.

```js
import { writable, computed } from "@manyducks.co/dolla";

// Let's assume this list of users was fetched from an API somewhere.
const $$people = writable([
  {
    id: 1,
    name: "Bob",
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
const $$selectedId = writable(2);

// Now we get the object of the person who is selected.
const $selectedPerson = computed([$$people, $$selectedId], ([people, selectedId]) => {
  return people.find((person) => person.id === selectedId);
});

// Now we get a Readable of just that person's name. Say we're going to display it on the page somewhere.
const $personName = computed($selectedPerson, (person) => person.name);

console.log($personName.get()); // "Bex"
```

Notice that the structure above composes a data pipeline; if any of the data changes, so do the computed values, but the relationship between the data remains the same. Now that we've defined these relationships, `$selectedPerson` is always the person pointed to by `$$selectedId`. `$personName` is always the name of `$selectedPerson`, etc.

### Unwrap

The `unwrap` function returns the current value of a Readable or Writable, or if passed a non-Readable value returns that exact value. This function is used to guarantee you have a plain value when you may be dealing with either a container or a plain value.

```js
import { readable, writable, unwrap } from "@manyducks.co/dolla";

const $$number = writable(5);

unwrap($$number); // 5
unwrap(readable(5)); // 5
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

As you may have guessed, you can pass Readables and Writables as props and slot them in in exactly the same way. This is important because Views do not re-render the way you might expect from other frameworks. Whatever you pass as props is what the View gets for its entire lifecycle.

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
        <span>List is hidden</span>
      )}
    </div>
  );
}
```

#### `repeat($items, keyFn, renderFn)`

The `repeat` helper repeats a render function for each item in a list. The `keyFn` takes an item's value and returns a number, string or Symbol that uniquely identifies that list item. If `$items` changes or gets reordered, all rendered items with matching keys will be reused, those no longer in the list will be removed and those that didn't previously have a matching key are created.

```jsx
function RepeatedListView() {
  const $items = readable(["Squirrel", "Chipmunk", "Groundhog"]);

  return (
    <ul>
      {repeat(
        $items,
        (item) => item, // Using the string itself as the key
        ($item, $index, ctx) => {
          return <ListItemView label={$item} />;
        }
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

#### Observing Readables

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
import { writable } from "@manyducks.co/dolla";

function CounterView(props, ctx) {
  const $$count = writable(0);

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
import { makeApp } from "@manyducks.co/dolla";

const app = makeApp();

// We define a store that just exports a message.
function MessageStore() {
  return {
    message: "Hello from the message store!",
  };
}

// Register it on the app.
app.store(MessageStore);

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

// Use LayoutView as the app's main view.
app.main(LayoutView);

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
import { makeApp } from "@manyducks.co/dolla";

const app = makeApp({
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

  // Router options control how routes are matched
  router: {
    hash: true, // Use hash-based routing
  },

  mode: "development", // or "production" (enables additional debug features and logging in "development")
});
```

#### Main View, Routes and Outlets

The main view (defined with the app's `main` method) is the top-level view that will always be displayed while the app is connected.

```jsx
// Here is a hypothetical main view with a layout and navigation:
app.main((props, ctx) => {
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
});

// Here are a couple of routes to be rendered into our layout:
app.route("/tasks", TasksView);
app.route("/completed", CompletedView);
```

Routes can also be nested. Just like the main view and its routes, subroutes will be displayed in the outlet of their parent view.

```jsx
app.route("/tasks", TasksView, (sub) => {
  sub.route("/", TaskListView);

  // In routes, `{value}` is a dynamic value that matches anything,
  // and `{#value}` is a dynamic value that matches a number.
  sub.route("/{#id}", TaskDetailsView);
  sub.route("/{#id}/edit", TaskEditView);

  // If the route is any other than the ones defined above, redirect to the list.
  // Redirects support './' and '../' style relative paths.
  sub.redirect("*", "./");
});
```

#### Routing

Dolla makes heavy use of client-side routing. You can define as many routes as you have views, and the URL
will determine which one the app shows at any given time. By building an app around routes, lots of things one expects
from a web app will just work; back and forward buttons, sharable URLs, bookmarks, etc.

Routing in Dolla is aesthetically inspired by [choo.js](https://www.choo.io/docs/routing)
with technical inspiration from [@reach/router](https://reach.tech/router/), as routes are matched by highest
specificity regardless of the order they were registered. This avoids some confusing situations that come up with
order-based routers like that of `express`. On the other hand, order-based routers can support regular expressions as
patterns which Dolla's router cannot.

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
import { PersonDetails, ThingIndex, ThingDetails, ThingEdit, ThingDelete } from "./components.js";

const app = createApp();

app
  .route("/people/{name}", PersonDetails)

  // Routes can be nested. Also, a `null` component with subroutes acts as a namespace for those subroutes.
  // Passing a view instead of `null` results in subroutes being rendered inside that view wherever `ctx.outlet()` is called.
  .route("/things", null, (sub) => {
    sub.route("/", ThingIndex); // matches `/things`
    sub.route("/{#id}", ThingDetails); // matches `/things/{#id}`
    sub.route("/{#id}/edit", ThingEdit); // matches `/things/{#id}/edit`
    sub.route("/{#id}/delete", ThingDelete); // matches `/things/{#id}/delete`
  });
```

As you may have inferred from the code above, when the URL matches a pattern the corresponding view is displayed. If we
visit `/people/john`, we will see the `PersonDetails` view and the params will be `{ name: "john" }`. Params can be
accessed inside those views through the built-in `router` store.

```js
function PersonDetails(props, ctx) {
  // `router` store allows you to work with the router from inside the app.
  const router = ctx.getStore("router");

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
