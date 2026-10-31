# Pending Decisions

These came up while fixing the bugs found in the October 2026 audit (branch `fix/audit-bugs`). Each one needs a product or API decision, so none has been implemented. Each entry gives the problem, the options, and a recommendation.

## Release blocker

### Bundle size budget

`npm run bundle:check` (run by `prepublishOnly`) fails. The "minimal component app" is **10,079 B** gzipped against a budget of **9,625.6 B** (`9.4 * KB` in `scripts/check-tree-shaking.mjs`). The check passed before the audit fixes. The increase is correctness code in paths the minimal app uses: signals, ElementNode, DynamicNode, FragmentNode, the scheduler and `isFunction`.

- **A.** Raise the budget to cover the fixes (earlier feature commits have done this).
- **B.** Look for bytes to cut in the affected modules first, then raise the budget by whatever remains.

Recommendation: B, with a time limit. Most of the new code is unavoidable.

## Signals and core

### Debug settings are global

`createRoot` calls `setSignalDebug`/`setUpdateStats`, which set module-level flags. A second root created without `debug` turns debugging off for the first. Files: `src/core/root.ts`, `src/core/signal-debug.ts`, `src/core/markup/scheduler.ts`.

- **A.** Make debug per root by reading it from the context. This is invasive, because stack capture happens when a signal is created, when no context is available.
- **B.** Count references: debug stays on while any mounted root asked for it, and the count drops on unmount.
- **C.** Only change the global flags when `debug` is passed explicitly.

Recommendation: B. C is the smallest change.

### Debounce behavior after an abort

`debounce` ignores a `signal` that was already aborted, and a later `call()` after an abort runs again. The abort listener is also never removed. Files: `src/core/debounce.ts`.

- **A.** Make abort permanent: `call()` does nothing once the signal (or `context`) is aborted, and the listener uses `{ once: true }`.
- **B.** Keep calls working after an abort (abort only cancels what is pending), and add a dispose API to remove the listener.

Recommendation: A.

## Rendering

### `on*` event prop names

`on*` props are just lowercased: `onDoubleClick` listens for `doubleclick`, which is never fired (the DOM event is `dblclick`). Camel-case custom events can only be reached through `on:`. Files: `src/core/markup/nodes/element.ts` (`#applyProps`).

- **A.** Map known React-style names to DOM names (`onDoubleClick` → `dblclick`, etc.).
- **B.** Keep lowercasing and document that `on:` should be used for anything else.

Recommendation: A for the handful of common mismatches, plus B in the docs.

### Reactive class updates overwrite the whole `class` attribute

The class fast paths added in `a3b7e4b` call `setAttribute("class", …)` when one value owns the element's classes. Classes added from outside (refs, third-party code) are wiped on every update. Before that commit they were kept, because updates went through `classList`. Files: `src/core/markup/nodes/element.ts` (`#applyClasses`).

- **A.** Keep the fast path for its speed, and document that `class` owns the attribute.
- **B.** Go back to `classList` add/remove, which keeps outside classes but is slower.
- **C.** Use the fast path until a class not set by dolla is seen on the element, then switch to `classList`.

Recommendation: A, unless a real integration needs outside classes.

## CSS and styled

### Keyframe names are global

`@keyframes fade` defined in two templates collide: the later one wins. Files: `src/core/markup/css.ts`.

- **A.** Document it and recommend unique names.
- **B.** Scope names declared in a template automatically (`fade` → `fade-<className>`) and rewrite references in that template's `animation` properties. References from other templates would break.
- **C.** Add an opt-in helper, e.g. ``${keyframes`...`}``, that returns a scoped name (like styled-components).

Recommendation: C, and A in the meantime.

### Style rules are never removed

Static interpolations create one class and one stylesheet rule per distinct value, and these are never freed. Per-instance values (lists, animations) make the stylesheet grow without limit. Files: `src/core/markup/css.ts`.

- **A.** Count references per className, using the disposer `attach()` now returns, and call `deleteRule` when a count reaches zero (possibly after a grace period).
- **B.** Put an LRU cap on per-value static templates.
- **C.** Steer per-value styles to getter interpolations (CSS variables), and warn in dev when one call site creates many classNames.

Recommendation: C now, A later if it matters.

### Styled component overrides don't reliably win

A class passed into a styled component should override the component's base styles. The registry inserts each rule once, at its first attach anywhere in the app. So if the override class was used somewhere else first, its rule comes earlier in the stylesheet and loses. The doc comment in `src/styled/index.ts` now says this. Styled bases and plain `css` deliberately share a className and rule when they are identical, which rules out simple fixes.

- **A.** Use separate stylesheets for styled bases and plain `css`. This needs distinct classNames, which breaks the dedup.
- **B.** Wrap styled base rules in `:where()` or a cascade layer. Unlayered and element selectors would then beat styled rules, which is a big behavior change.
- **C.** Document a specificity bump (`&&`) for overrides.

Recommendation: C (now in the doc comment). Consider A if guaranteed overrides matter.

## Router, HTTP, translate

### Translation caching

`setLocale` calls the locale's fetch function every time, so switching fr → en → fr fetches fr twice. Files: `src/translate/index.ts`.

- **A.** Cache the built lookup per locale, but only after a successful load (failures still retry).
- **B.** A, plus `setLocale(name, { reload: true })` to force a fresh fetch.
- **C.** Keep re-fetching and document it.

Recommendation: A. Add B only if someone needs it.

## Optional optimizations

### Virtual list scroll handler

Each scroll event runs the full slice update (about `poolSize` signal writes) even when the visible range hasn't changed. This causes no DOM changes, because unchanged atoms skip notification, so it is CPU cost only. Files: `src/virtual/index.ts`.

- Skip the pool loop when the start index, item count, items array, average height and layout version are all unchanged.
