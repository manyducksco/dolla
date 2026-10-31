# Hot Module Replacement

Dolla supports HMR for view components during development. When using Vite, view functions are automatically replaced in active component instances without a full page reload.

HMR is development-only. On update, the view function is re-executed and its output is replaced. Local atoms, refs, and effects in that view reset. This is the one development-time case where a view body runs again.

## Setup

Add the Dolla Vite plugin to your `vite.config.js`:

```js
import { defineConfig } from "vite";
import dolla from "@manyducks.co/dolla/vite-plugin";

export default defineConfig({
  plugins: [dolla()],
});
```

The Vite plugin auto-injects HMR registration into exported view functions. When a module updates, active component instances receive the new view function and their DOM subtree is replaced in place. State inside those views is discarded.

## Stores

Stores are matched by the store function itself, not its name, so `getStore` finds the instance that `addStore` created with the same function. To keep that working across hot reloads, the Vite plugin wraps exported functions in a stable wrapper. A module can be re-evaluated any number of times and the export stays the same function.

Exported stores keep their existing instance and state when their module reloads, as long as they are declared in one of these forms:

```js
export function AuthStore(props, c) {}
export const AuthStore = (props, c) => {};
export const AuthStore = function (props, c) {};
export default function AuthStore(props, c) {}
```

Other stores get a new identity when their module reloads, and a fresh instance is created the next time a provider calls `addStore`. This covers stores that aren't exported, stores created by a function call (`export const AuthStore = makeStore()`), and stores exported in a separate statement (`export { AuthStore }`).

## Manual API

If you're not using Vite, you can wire up HMR yourself:

```js
import {
  __dolla_export,
  __dolla_apply,
  registerViewInstance,
  unregisterViewInstance,
} from "@manyducks.co/dolla/hmr";
```

- `__dolla_export(id, view)` wraps a view or store so updates can be matched to it. It returns the same wrapper every time it is called with the same `id`, which is what keeps stores' identity across reloads.
- `registerViewInstance(view, node)` registers a mounted `ViewNode` so it can be replaced.
- `unregisterViewInstance(view, node)` removes the registration on unmount.
- `__dolla_apply(newModule, exports)` applies the updated view exports to matching instances.

## Limitations

- State local to a replaced view is lost. Move state you want to survive into a store or a context outside the replaced view.
- A full page reload discards all application state, as expected.
- HMR only applies to view modules; changes to stores, utility modules, or global CSS may trigger a full reload depending on your bundler setup.
