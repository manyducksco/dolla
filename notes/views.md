```tsx
import { View, Store, $, $$ } from "@manyducks.co/dolla";

const SomeView = View("SomeView")
  .props((t) => ({
    // Define prop types which are validated and enforced in dev mode
    $name: t.readable(t.string().optional()).optional(), // Readable<string | undefined> | undefined
  }))
  .build(({ $name }, ctx) => {
    const { $value } = ctx.getStore(SomeStore);

    return <h1>Hello {$name}</h1>;
  });

const SomeStore = Store("SomeStore").build((ctx) => {
  const $$value = $$(0);

  return {
    $value: $($$value),
  };
});
```

Thoughts on reintegrating core APIs instead of keeping them as modular stores. In the case of things like the router, they really are core pieces masquerading as modular stores.

```tsx
import { App } from "@manyducks.co/dolla";

const app = new App();

// All routes are defined using a config object.
app.route({
  path: "/",
  view: RootView,
  routes: [
    { path: "/example", view: ExampleView },
    { path: "/notes", view: NotesView },
  ],
});
app.route({ path: "*", redirect: "/example" });

function SomeView(props, ctx) {
  // Route info and routing are exposed on ctx.route
  ctx.route.go("/some-route", { preserveQuery: true, replace: false });
  ctx.route.back();
  ctx.route.forward();
  ctx.route.$$query;
  ctx.route.$params;
  ctx.route.$path;
  ctx.route.$pattern;
}
```

HTTP is also integrated:

```tsx
function SomeView(props, ctx) {
  ctx.http.get("/some-route");
  ctx.http.post("/some-route", { body: { data: 123 } });
  // ... and the rest of the methods
}
```

Language support is also integrated:

```tsx
const app = new App();

app.language({ name: "en", path: "/locale/en.json" });
app.language({ name: "ja", path: "/locale/ja.json" });
app.setLanguage("en" /* or localStorage.getItem("appLanguage") or something */);

function SomeView(props, ctx) {
  ctx.language.$current;
  ctx.language.set("ja");
  ctx.language.translate$("some.key");

  // I would probably use it like this:
  const { translate$ } = ctx.language;
  translate$("some.key");
}
```

## Stores vs Context variables

Now, these are going away as stores. But what about stores? I'd like to replace stores with context variables, like this:

```tsx
function ParentView(props, ctx) {
  // Variables can be set in this context...

  ctx.set("fixedValue", 1);

  const $$writable = $$(2);
  ctx.set("$$writableValue", $$writable);

  return <ChildView />;
}

function ChildView(props, ctx) {
  // ... and accessed in a child context.

  const fixed = ctx.get<number>("fixedValue"); // 1
  const $$writable = ctx.get<Writable<number>>("$$writableValue"); // Writable(2)

  // Overriding values will not change parent variables. This value will take effect for this context and any child context.
  ctx.set("fixedValue", 2);

  return <span>{$$writable}</span>;
}

// Now stores can be written and used in this way:

function ExampleStore(ctx: ViewContext) {
  ctx.beforeConnect(() => {
    // Takes whatever arguments, in this case the ViewContext itself so it can attach lifecycle methods.
  });

  return {
    whatever: 1,
  };
}

function ExampleView(props, ctx) {
  ctx.set("example", ExampleStore(ctx));

  // ...
}

function ChildView(props, ctx) {
  const example = ctx.get("example");

  ctx.log(example.whatever); // prints: 1
}
```

Or as a class-based thing:

```tsx
import { View, Store } from "@manyducks.co/dolla";

// Stores are basically an observable map with computed properties.
const example = new Store({
  computed: {
    uppercased: (values) => values.key.toUpperCase(),
  },
});

// Set one or more properties at a time.
example.set({ key: "value" });

// Get the current value of any property by name.
example.get("uppercased"); // "VALUE"

// Can subscribe to specific entries.
const sub = example.subscribe("key", (value) => {
  // Do something when value changes.
});
sub.unsubscribe();
sub.current; // get current value of entry

// Get a two-way binding to a particular entry.
const bound = example.bind("key");
const boundSub = bound.subscribe((value) => {
  // Do something when value changes.
});
boundSub.current; // get current value
bound.get();
bound.set(newValue);

// Now Views have a state that works in a very similar way.

interface ExampleViewState {
  whatever: number;
}

interface ExampleViewProps {
  // Bound values can be passed as props to child views.
  something: Bound<string>;
}

class ExampleView extends View<ExampleViewState, ExampleViewProps> {
  create() {
    this.state.set({ whatever: 5 });

    const whatever = this.state.bind("whatever");

    this.state.subscribe("whatever", (value) => {
      // This will be automatically cleaned up when the view is disconnected.
    });

    this.props.something.get(); // get the value of the bound prop.
  }
}
```
