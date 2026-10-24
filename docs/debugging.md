# Debugging

Dolla includes a small, filterable logging layer.

Examples assume the relevant helpers are imported from `@manyducks.co/dolla` unless an import is shown.

## Creating a logger

```js
import { createDebug } from "@manyducks.co/dolla";

const debug = createDebug("my-app", ["version", "1.0"]);

debug.info("started");
debug.warn("something looks off");
```

Available methods: `info`, `trace`, `log`, `warn`, and `error`.

The first argument is the logger name. It may be a getter if the name should be read lazily. Additional arguments are tag pairs (`[key, value]`) rendered in the log prefix.

## Getting a logger from a context

`getDebug(context, ...tags)` uses the context's name:

```jsx
function UserCard(props, context) {
  context.name = "UserCard";
  const debug = getDebug(context, ["user", userId]);
  debug.log("rendered");
  return <article>...</article>;
}
```

Views are named automatically from the function name. Setting `context.name` overrides it. `this.name` also works inside a function declaration.

## Levels

```js
import { setLogLevel } from "@manyducks.co/dolla";

setLogLevel("warn"); // show warn + error
setLogLevel("silent"); // disable all debug output
```

Accepted levels: `info`, `log`, `warn`, `error`, `silent`. The default is `info`.

## Filtering by name

```js
import { setLogFilter } from "@manyducks.co/dolla";

setLogFilter((name) => name.startsWith("my-app:"));
setLogFilter(() => true); // show everything
```

The default filter hides framework loggers whose names start with `dolla:`. Setting a filter replaces that default.

## Debug mode

Enable debug attributes on the root:

```jsx
await createRoot("#app", { debug: true }).mount(App);
```

In debug mode, elements receive a `data-view` attribute containing the nearest view's context name. This is useful for inspecting the DOM and building view-related tooling.

## Notes

- Loggers are cheap no-ops when the level or filter excludes them, but the call sites still execute.
- `getDebug` uses the context name, so keep `context.name` stable if you rely on log filtering.
- Module loggers use their own names; namespace them (for example `my-app:router`) and filter accordingly.

## Next steps

- [Hooks](./hooks.md) — `getDebug` in the hook reference
- [App root](./root.md) — `createRoot` options
- [Cheatsheet](./cheatsheet.md) — quick lookups
