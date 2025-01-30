# Scratch Note

---

Bring the $ back and the name full circle.

```js
import { $, $$ } from "@manyducks.co/dolla";

// Shorthand dolla sign

// An initial value (with optional options object) creates a state.
const [$count, setCount] = $(0);
// = createState(0)

// An array and a function derives a state.
const $doubled = $.derive([$count], (count) => count * 2);
// = derive([$count], (count) => count * 2);

// A state returns the same state.
const $sameCount = $.of($count);
const $wrapped = $.of({ message: "This is a state with no setter." });
// = toState($count)

// Get value from a state. Values that are not states are returned directly.
const count = $.get($count);

// An initial value creates a SettableState
const $$count = $$(5);
// = createSettableState(5);

// Merge state and setter into a SettableState
const $$count = $$($count, setCount);
// = toSettableState($count, setCount);

// Split a SettableState into a state and setter
const [$count, setCount] = $($$count);
```

---

I've been looking into other libraries that don't make you track your dependencies specifically. I think this is weird and unhinged to be honest. Calling functions with side effects that magically re-run things when the value changes is a truly weird and unexpected lifecycle. At least if you're explicitly tracking dependencies you know exactly what depends on what at a glance. Getting the computer to figure it out for you doesn't seem smart.

```js
import { $ } from "@manyducks.co/dolla";

const [count, setCount] = $(0);

const doubled = $.computed(() => count() * 2);

$.effect(() => {
  console.log(doubled());
});

$.batch(() => {
  // Set multiple things but defer updates to after this function returns.
});

// Helpers on $; can plug into template as is.
$.if(
  $.computed(() => count() > 5),
  <span>Greater than 5!</span>,
  <span>Not greater than 5...</span>,
);

const switched = $.switch(count, [[1, "one"], [2, "two"], [3, "three"]], "more...");

$.repeat()

// TODO: How feasible is this?
<Repeat each={}>
  {(item, index) => {

  }}
</Repeat>

<Show when={condition}>
  Condition is true.
</Show>

// Get
count();

// Set
count(52);
```

---

What if Dolla was just a global object that you don't instantiate. I have never personally run into a use case for having more than one app on a page at once. In all my projects, the page and the app are synonymous.

Doing this would make it possible to access things inside the Dolla app from _outside_ code such as Quill blots. Effectively all code that has access to your Dolla import is _inside_ the app.

- Remove stores in favor of just exporting variables and functions from ES modules and importing them where desired.
-

```jsx
import Dolla from "@manyducks.co/dolla";

// Languages: add translation, set language and get localized string as a signal
Dolla.i18n.setup({
  initialLanguage: Dolla.i18n.detect({ fallback: "ja" }), // Detect user's language and fall back to passed value
  languages: [
    { name: "ja", path: "/static/locales/ja.json" },
    {
      name: "en",
      fetch: async () => {
        // Pass a path string, or if additional logic is needed, a fetch function.
        const res = await Dolla.http.get("/static/locales/en.json");
        return res.body;
      }
    }
  ]
});

Dolla.i18n.$locale
Dolla.i18n.t$()

// A single setup call to keep things contained (must happen before mount)
Dolla.router.setup({
  // Initial path must point to a route that actually exists (will be validated on mount) (initialPath is "/" by default)
  initialPath: "/",
  routes: [
    { path: "/", view: SomeView }
  ]
});
// And then you can route from anywhere.
Dolla.router.go("/some/path");
// Or get route information from anywhere.
Dolla.router.$path;
Dolla.router.$params;

// Also utils are available
const joinedPath = Dolla.router.utils.joinPath("/api/records", "5");
const resolvedPath = Dolla.router.utils.resolvePath("../"); // Resolves with window.location.href as the base

// Initializes the app and matches first route
Dolla.mount("#app");
// If you pass a view as the second argument it becomes the root view (this works for simple apps without a router)
Dolla.mount("#app", MyRootView);
// If router setup function wasn't called then the root view is mounted equivalent to the following:
Dolla.router.setup({
  defaultPath: "/",
  routes: [
    { path: "/*", view: MyRootView },
  ]
});

// Add HTTP middleware
Dolla.http.use(async (req, next) => {
  const res = await next()
});
// Make HTTP calls
const res = await Dolla.get("/some/path");

// Adjust log level
Dolla.setLogLevel(Dolla.LOG_LEVEL_INFO);
Dolla.setLogFilter("*,-Dolla/*")
// Create a scoped logger
const debug = Dolla.createLogger("debug-logger");
debug.log("HELLO");
debug.warn("THIS IS A SCOPED LOGGER");

// Efficiently and safely read and mutate the DOM using Dolla's render batching
Dolla.batch.read(() => {
  // Reference DOM nodes
});
Dolla.batch.write(() => {
  // Mutate the DOM as part of Dolla's next batch
}, "some-key");

// Respond to lifecycle events
Dolla.onMount(() => {});
Dolla.onRouteMatch(() => {});
// Dolla.onWhatever(() => {});

interface SomeViewProps {}

function SomeView (props: SomeViewProps, ctx: Dolla.ViewContext) {
  const debug = Dolla.createLogger("SomeView");

  // returns a signal and a setter function
  const [$someValue, setSomeValue] = Dolla.createState(4);

  // Router is now a part of the Dolla object
  Dolla.router.$path;
  Dolla.router.$params;

  Dolla.router.go("/some-other-path");

  ctx.watch([$someValue], (value) => {
    debug.log(value);
  });

  // View helpers are on ViewContext
  ctx.repeat()
  ctx.cond()
  ctx.render([...states], (...values) => {
    // return Renderable (equivalent to Dolla.derive(states, (...values) => Renderable))
  })
  ctx.portal()
  ctx.outlet()

  // TODO: Add Dolla.dialog.show() and Dolla.toast.show() or create separate libraries?

  return <h1>{ctx.t$("home.headerText")}</h1>;
}
```

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
