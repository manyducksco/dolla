# Migrating from 4.x to 5.0

Dolla 5.0 has a smaller main entry, a structured error pipeline, and fixes that change some behavior. This page lists everything a 4.9 app may need to change. Most apps only need the [checklist](#checklist).

## Checklist

1. Rename `forEach` to `repeat` and `unwrap` to `get`.
2. Replace `showUnless` with `hideIf` and `hideUnless` with `showIf`.
3. Import `styled` from `@manyducks.co/dolla/styled`.
4. Import low-level APIs (`createEffect`, `subscribe`, `createMarkup`, `render`, node classes, `createContext`) from `@manyducks.co/dolla/internals`.
5. Remove `keepAlive`, `onShow`, `onHide`, `isVisible`, `createView` and `createStore`. See [Removed APIs](#removed-apis).
6. Rewrite `onEffect` calls that pass a deps array. See [Effects](#effects).
7. Rewrite router params from `{id}` and `{#id}` to `:id`, and replace `router.block`. See [Router](#router).
8. Remove calls to `css.named`, `.preinsert()` and `http.trace()`.
9. Add a `createRoot(..., { onError })` handler if you relied on errors from effects reaching your own code. See [Errors](#errors).
10. Check any CSS, test or code that depends on generated class names. See [CSS and styled](#css-and-styled).

## Moved APIs

| 4.9 import from `@manyducks.co/dolla`                                                                                                                        | 5.0 import from                                                |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `styled`, `StyledView`                                                                                                                                       | `@manyducks.co/dolla/styled` (which also exports `TemplateFn`) |
| `createEffect`, `subscribe`                                                                                                                                  | `@manyducks.co/dolla/internals`                                |
| `createMarkup`, `render`                                                                                                                                     | `@manyducks.co/dolla/internals`                                |
| `DOMNode`, `DynamicNode`, `ElementNode`, `PortalNode`, `RepeatNode`, `ViewNode`                                                                              | `@manyducks.co/dolla/internals`                                |
| `createContext`, `mountContext`, `cleanupContext`                                                                                                            | `@manyducks.co/dolla/internals`                                |
| `getNearestViewNode`, `getRootElement`, `hasStore`, `hasOwnStore`                                                                                            | `@manyducks.co/dolla/internals`                                |
| Types: `Markup`, `MarkupNode`, `CSSProperties`, `InputType`, `Interpolation`, `InterpolationValue`, `PropertyConfig`, `CoreCSSSyntax`, `CSSSyntaxDescriptor` | `@manyducks.co/dolla/internals`                                |

`createEffect` no longer accepts deps; see [Standalone effects](./advanced.md#standalone-effects). `subscribe` now uses its callback's return value: a returned function runs as cleanup before the next call. See [Subscribing to changes](./reactivity.md#subscribing-to-changes).

## Renamed APIs

| 4.9                                        | 5.0                                                     |
| ------------------------------------------ | ------------------------------------------------------- |
| `forEach(items, keyFn, render)`            | `repeat(items, keyFn, render)`, with the same arguments |
| `unwrap(value)`                            | `get(value)`                                            |
| `showUnless(condition, content, fallback)` | `hideIf(condition, content, fallback)`                  |
| `hideUnless(condition, content, fallback)` | `showIf(condition, content, fallback)`                  |
| `:name` attribute shorthand                | `attr:name`                                             |

## Removed APIs

- **`keepAlive` and the `KeepAlive` type.** Hidden branches always unmount. Keep state that must survive in a store or in an atom created outside the conditional. To keep DOM alive, leave it mounted and toggle the `hidden` attribute or a class.
- **`onShow`, `onHide` and `isVisible`.** Use `onMount` and `onCleanup`. Content that used to be hidden is now unmounted and mounted again.
- **`createView` and `createStore`.** They only helped type inference. Type the function directly, for example `const Counter: View<CounterProps> = (props, context) => ...`.
- **`ReactiveProps` and `Env`.** Type each prop as what it is: `T`, `Getter<T>` or `MaybeGetter<T>`. See [Props follow their declared types](./concepts.md#props-follow-their-declared-types).
- **`css.named()`, `template.named()` and `template.preinsert()`.** Classes are always `css-<hash>`, and rules are inserted on first use.
- **`http.trace()`.** `fetch` rejects `TRACE` requests, so it could never succeed.
- **`@event` JSX props.** They were never handled at runtime. Use `onClick` or `on:click`.
- **The catch-all JSX element type.** Unknown tags without a hyphen are now type errors. Custom elements (`my-element`) are still accepted.

## Effects

`onEffect` and `createEffect` no longer take a deps array or a `deps` option. Read the values you depend on in the callback, and use `peek` for anything that shouldn't trigger a re-run:

```js
// 4.9
onEffect(context, (id) => loadUser(id, getSettings()), [getUserId]);

// 5.0
onEffect(context, () => {
  const id = getUserId();
  peek(() => loadUser(id, getSettings()));
});
```

`onEffect` now returns a function that stops the effect early. See [Stopping early](./effects.md#stopping-early).

Other changes:

- Effect cleanups run untracked.
- An effect's child effects are disposed before it re-runs.
- Effects created inside `peek`, a `subscribe` callback or a setter updater within a running effect belong to that effect and are disposed with it. In 4.9 they were never disposed.
- Async effect callbacks report an error. Effects must be synchronous; start async work from inside the effect instead.
- `createSetter` updaters run untracked.
- A getter returned from a `compose` callback is read on every recompute, not just the first.

## Errors

Errors thrown in effects, effect cleanups, scheduled DOM updates and lifecycle listeners no longer propagate to the caller. In 4.9 an effect that threw during mount made `root.mount()` reject. In 5.0 the error is wrapped in a `SignalError` and reported:

```js
createRoot("#app", {
  onError(error) {
    console.error(error.phase, error.cause);
  },
}).mount(App);
```

Without `onError`, errors go to `reportError`, which fires the window `error` event. One throwing listener no longer stops the others.

Errors read through `compose` getters, `peek` and setter updaters are rethrown as a `SignalError`. `instanceof` checks against your own error classes fail on the wrapper; use `isSignalError(error) ? error.cause : error`. See [Errors](./errors.md).

## Root

- `createRoot` takes `{ debug, onError }`. Debug mode is per root, and signal creation locations are only recorded in a root created with `debug: true`.
- `root.unmount()` is synchronous. `await root.unmount()` still works; `root.unmount().then(...)` doesn't.
- Calling `mount()` again while a mount is in progress reuses it. Mounting over an element that already hosts a root unmounts the old root first.

## Stores

Stores are identified by their function, not by `store.name`. Two different stores with the same name no longer collide, and a different function with the same name no longer finds an existing store. With the Vite plugin, exported store functions keep their identity across hot reloads; see [HMR](./hmr.md#stores).

## Templates and attributes

- When no css templates are involved, a reactive `class` value replaces the whole `class` attribute. Classes added with `classList` are removed on the next update. Put every class in the `class` value.
- Style objects are applied one property at a time, so they no longer wipe other inline styles. A reactive style value of `0` is applied instead of removed.
- `null` on a property such as `value` or `textContent` clears it.
- `repeat` renders only the first of several items with the same key and logs a warning.

## CSS and styled

- Generated class names changed and may change again. Don't select them in CSS or tests.
- `styled(...).named(name)` only sets the view name shown in debug mode. It no longer changes the class.
- Each `styled` call site gets its own class, and classes passed to a styled component override its base styles. Remove specificity workarounds.
- A styled component merges `className` into `class`.
- Reactive css interpolations become inline custom properties on the element instead of per-instance classes.
- `null`, `undefined` and `false` interpolations emit nothing.
- Dolla warns when one `css` call site creates 50 classes from different static values. Use getters for per-instance values.
- New `keyframes` helper for generated animation names. See [CSS](./css.md).

## Router

- Params use `:name` instead of `{name}`. `{#name}` numeric params and `{name?}` optional params are gone: check numbers yourself, and define the route with and without the optional segment.
- `router.block()` is removed. Add your own `beforeunload` listener for unsaved changes, and redirect from `preload` with `throw new RedirectError(path)` for guards.
- `createRouter` throws on duplicate patterns (`/users/:id` and `/users/:userId` count as the same) and on segments after `*`.
- Redirect loops throw instead of hanging.
- The query string is kept on navigation, and `setQuery` keeps the fragment.
- Hash mode keeps the page's path, so an app served from `/app/` uses `/app/#/route` URLs.
- `push("#top")` stays on the current path, and in-page `#` links are left to the browser.
- Nested routes merge `meta` from every ancestor.
- An error from `preload` or lazy loading is handled by the failing route's `errorView`, or the nearest ancestor's.

See the [router README](../src/router/README.md).

## Translate

- `setLocale("xx")` rejects when `xx` has no translations, and so does mounting with such a `locale` option. In 4.9 it silently loaded the first locale.
- Without a `locale`, the first of `navigator.languages` with translations is used, or else the first locale.
- Loaded locales are cached and dropped after five minutes unused. A translation fetch function no longer runs on every switch.
- When `setLocale` calls overlap, the last one wins.
- A missing context or plural variant falls back to the base key.
- Formatter options `true`, `false` and numbers are passed as booleans and numbers. Custom formatters may receive them.
- An unknown formatter logs a warning.

See the [translate README](../src/translate/README.md).

## HTTP

- `trace()` is removed.
- Array query values become repeated params (`?tag=a&tag=b`) instead of `tag=a,b`.
- `HEAD` requests, 204/205/304 responses and empty JSON bodies have an `undefined` body instead of throwing.
- An error response whose body can't be parsed throws `HTTPResponseError` instead of a `SyntaxError`.
- Object and array bodies are serialized when you set a JSON content-type yourself.
- Middleware that returns nothing without calling `next()` rejects.
- Only URIs with a scheme are absolute. `api/items` is relative.

See the [HTTP README](../src/http/README.md).

## Virtual lists

Measured heights are remembered by `keyFn(item)`, so `keyFn` must be stable and unique. The list releases its observers, listeners and timers on unmount.

## Vite plugin and packaging

- The Vite plugin only runs on the dev server. Production builds are untouched.
- The plugin wraps more export forms so stores and views keep their identity across hot reloads, and only names `styled` components imported from `@manyducks.co/dolla/styled`.
- `vite` is an optional peer dependency, needed only for the plugin.
- JSX types now resolve in consumer projects. Remove any local workaround for "no interface JSX.IntrinsicElements".
