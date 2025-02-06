# Views

Views are one of two component types in Dolla. We call them views because they deal specifically with presenting visible things to the user. The other type of component, [Stores](./stores.md), deal with data and events.

At its most basic, a view is a function that returns elements.

```jsx
const ExampleView = createView(function () {
  return <h1>Hello World!</h1>;
});
```

## View Props

A view function takes a `props` object as its first argument. This object contains all properties passed to the view when it's invoked.

```jsx
const ListItemView = createView(function (props) {
  return <li>{props.label}</li>;
});

const ListView = createView(function () {
  return (
    <ul>
      <ListItemView label="Squirrel" />
      <ListItemView label="Chipmunk" />
      <ListItemView label="Groundhog" />
    </ul>
  );
});
```

As you may have guessed, you can pass States as props and slot them in in exactly the same way. This is important because Views do not re-render the way you might expect from other frameworks. Whatever you pass as props is what the View gets for its entire lifecycle.

## View Helpers

### `cond($condition, whenTruthy, whenFalsy)`

The `cond` helper does conditional rendering. When `$condition` is truthy, the second argument is rendered. When `$condition` is falsy the third argument is rendered. Either case can be left null or undefined if you don't want to render something for that condition.

```jsx
const ConditionalListView = createView(function (props) {
  return (
    <div>
      {cond(
        props.$show,

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
});
```

### `repeat($items, keyFn, renderFn)`

The `repeat` helper repeats a render function for each item in a list. The `keyFn` takes an item's value and returns a number, string or Symbol that uniquely identifies that list item. If `$items` changes or gets reordered, all rendered items with matching keys will be reused, those no longer in the list will be removed and those that didn't previously have a matching key are created.

```jsx
const RepeatedListView = createView(function () {
  const [$items, setItems] = createState(["Squirrel", "Chipmunk", "Groundhog"]);

  return (
    <ul>
      {repeat(
        $items,
        (item, index) => item, // Using the string itself as the key
        ($item, $index, context) => {
          return <ListItemView label={$item} />;
        },
      )}
    </ul>
  );
});
```

### `portal(content, parentNode)`

The `portal` helper displays DOM elements from a view as children of a parent element elsewhere in the document. Portals are typically used to display modals and other content that needs to appear at the top level of a document.

```jsx
const PortalView = createView(function () {
  const content = (
    <div class="modal">
      <p>This is a modal.</p>
    </div>
  );

  // Content will be appended to `document.body` while this view is connected.
  return portal(document.body, content);
});
```

## View Context

A view function takes a context object as its second argument. The context provides a set of functions you can use to respond to lifecycle events, observe dynamic data, print debug messages and display child elements among other things.

The context can be accessed in one of two ways; as `this` when you pass a non-arrow function, or as the second parameter passed after the props object.

```jsx
// Option 1: Access through `this`
const ExampleView = createView(function (props) {
  this.onMount(() => {
    this.log("HELLO!");
  });

  return <h1>Hello World!</h1>;
});

// Option 2: Access as second argument (for arrow functions)
const ExampleView = createView((props, ctx) => {
  ctx.onMount(() => {
    ctx.log("HELLO!");
  });

  return <h1>Hello World!</h1>;
});
```

Which one you use is just an aesthetic preference, but I kind of like the classic `function` syntax with `this`.

### Printing Debug Messages

```jsx
const ExampleView = createView(function (props) {
  // Set the name of this view's context. Console messages are prefixed with name.
  this.setName("CustomName");

  // Print messages to the console. These are suppressed by default in the app's "production" mode.
  // You can also change which of these are printed and filter messages from certain contexts in the `createApp` options object.
  this.info("Verbose debugging info that might be useful to know");
  this.log("Standard messages");
  this.warn("Something bad might be happening");
  this.error("Uh oh!");

  // If you encounter a bad enough situation, you can halt and disconnect the entire app.
  this.crash(new Error("BOOM"));

  return <h1>Hello World!</h1>;
});
```

### Lifecycle Events

```jsx
const ExampleView = createView(function (props) {
  this.beforeMount(() => {
    // Do something before this view's DOM nodes are created.
  });

  this.onMount(() => {
    // Do something immediately after this view is connected to the DOM.
  });

  this.beforeUnmount(() => {
    // Do something before removing this view from the DOM.
  });

  this.onUnmount(() => {
    // Do some cleanup after this view is disconnected from the DOM.
  });

  return <h1>Hello World!</h1>;
});
```

### Displaying Children

The context has an `outlet` function that can be used to display children at a location of your choosing.

```js
const LayoutView = createView(function (props) {
  return (
    <div className="layout">
      <div className="content">{this.outlet()}</div>
    </div>
  );
});

const ExampleView = createView(function () {
  // <h1> and <p> are displayed inside LayoutView's outlet.
  return (
    <LayoutView>
      <h1>Hello</h1>
      <p>This is inside the box.</p>
    </LayoutView>
  );
});
```

### Watching States

The `watch` function starts observing when the view is connected and stops when disconnected. This takes care of cleaning up watchers so you don't have to worry about memory leaks.

```jsx
const ExampleView = createView(function (props) {
  const [$count, setCount] = createState(0);

  // This callback will run when any states in the dependency array receive new values.
  this.watch([$count], (count) => {
    this.log("count is now", count);
  });

  // ...
});
```

### Context Variables

> TODO: Write about context state (`.get` and `.set`)

### Context Events

Events can be emitted from views and [stores](./stores.md) using `this.emit(eventName, data)`. Context events will bubble up the view tree just like native browser events bubble up the DOM tree.

```js
this.on("eventName", (event) => {
  event.type; // "eventName"
  event.detail; // the value that was passed when the event was emitted (or undefined if none)
});

this.once("eventName", (event) => {
  // Receive only once and then stop listening.
});

// Remove a listener by reference.
// Listener must be the same exact function that was passed to `on` or `once`.
this.off("eventName", listener);

// Emit an event.
this.emit("eventName", { value: "This object will be exposed as event.detail" });
```

### Bubbling

Events bubble up through the view tree unless `stopPropagation` is called by a listener. In the following example we have a view listening for events that are emitted from a child of a child.

```js
const ParentView = createView(function () {
  // Listen for greetings that bubble up.
  this.on("greeting", (event) => {
    const { name, message } = event.detail;

    this.log(`${name} says "${message}"!`);
  });

  return (
    <div>
      <ChildView />
    </div>
  );
});

const ChildView = createView(function () {
  this.on("greeting", (event) => {
    // Let's perform some censorship.
    // If propagation is stopped this event will not bubble any further and ParentView won't see it.
    if (containsForbiddenKnowledge(event.message)) {
      event.stopPropagation();
    }
  });

  return (
    <div>
      <ChildOfChildView />
    </div>
  );
});

const ChildOfChildView = createView(function () {
  return (
    <form
      onSubmit={(e) => {
        // This is a browser event handler.
        // Browser events can't be listened for with `this.on`, but we can emit context events from here that can be.
        e.preventDefault();

        // Pluck the values from the form.
        const name = e.currentTarget.name.value;
        const message = e.currentTarget.message.value;

        // Emit!
        this.emit("greeting", { name, message });
      }}
    >
      <input type="text" name="name" placeholder="Your Name" />
      <input type="text" name="message" placeholder="Your Message" />
      <button type="submit">Submit</button>
    </form>
  );
});
```

---

End.

- [🗂️ Docs](./index.md)
- [🏠 README](../README.md)
- [🦆 That's a lot of ducks.](https://www.manyducks.co)
