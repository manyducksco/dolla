# Pending Decisions

These came up while fixing the bugs found in the October 2026 audit (branch `fix/audit-bugs`). Each one needs a product or API decision, so none has been implemented. Each entry gives the problem, the options, and a recommendation.

## Build

### `mangleProps` is ignored

Both `vite.config.ts` and `scripts/check-tree-shaking.mjs` pass `oxc: { mangleProps: /^_/ }`, but Vite 8's oxc minifier has no property mangling. The option does nothing, and the published `dist` keeps names like `_depsTail` and `_flags`. Mangling them would save about 110 B gzipped in the minimal app. The bundle check passes without it (9,500 B against a 9,625.6 B budget).

- **A.** Remove the dead option from both files.
- **B.** Get mangling working, for example with terser's `mangle.properties` (a new devDependency), for both `dist` and the check.

Recommendation: A, unless the extra headroom is wanted.

## Signals and core

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

## Optional optimizations

### Virtual list scroll handler

Each scroll event runs the full slice update (about `poolSize` signal writes) even when the visible range hasn't changed. This causes no DOM changes, because unchanged atoms skip notification, so it is CPU cost only. Files: `src/virtual/index.ts`.

- Skip the pool loop when the start index, item count, items array, average height and layout version are all unchanged.
