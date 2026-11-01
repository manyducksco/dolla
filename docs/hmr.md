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

The plugin only runs on the dev server. Production builds are left untouched.

## Stores

Stores are matched by the store function itself, not its name, so `getStore` finds the instance that `addStore` created with the same function. To keep that working across hot reloads, the Vite plugin wraps exported functions in a stable wrapper. A module can be re-evaluated any number of times and the export stays the same function.

Stores keep their existing instance and state when their module reloads, as long as they are declared in one of these forms:

```js
export function AuthStore(props, c) {}
export const AuthStore = (props, c) => {};
export const AuthStore = function (props, c) {};
export default function AuthStore(props, c) {}
```

A store kept private behind helpers keeps working too:

```js
function AuthStore(props, c) {}
export const addAuth = (c) => addStore(c, AuthStore);
export const getAuth = (c) => getStore(c, AuthStore);
```

When a module passes a function it declares to `addStore`, `getStore`, `hasStore` or `hasOwnStore` by name, the plugin tags that argument with the store's HMR id, so every version of the function shares one identity. This also covers import cycles, where a reloaded module's helpers can be called before the module has finished evaluating.

Other stores get a new identity when their module reloads, and a fresh instance is created the next time a provider calls `addStore`. Until then, looking up the old instance with the new function fails. This covers stores created by a function call (`export const AuthStore = makeStore()`), stores exported in a separate statement (`export { AuthStore }`), and stores passed to dolla through another variable.

## Import cycles

When you edit a module, Vite gives every module that imports it a new URL, and the edited module imports again whichever of those it imports itself. So a hot update re-runs every module that's in an import cycle with the edited one. If the module that calls `createRoot` is in the cycle, each edit runs it again and mounts the app a second time.

The Vite plugin warns in the terminal when an edit does this, once per cycle, and shows the chain:

```
[dolla:hmr] Editing src/pages/Workspace.tsx re-runs src/app.tsx, which creates the app root, because they import each other:
  src/pages/Workspace.tsx
  -> src/stores/auth.ts
  -> src/rpc.ts
  -> src/app.tsx
  -> src/pages/Workspace.tsx
src/rpc.ts imports src/app.tsx, so a hot update to any module in this cycle runs src/app.tsx again and mounts the app a second time. Remove that import to break the cycle.
```

The usual cause is a module importing something from the entry module, such as a shared context. Pass the value to that module instead, or move it into a module of its own.

## Manual API

If you're not using Vite, you can wire up HMR yourself:

```js
import {
  __dolla_export,
  __dolla_store,
  __dolla_apply,
  registerViewInstance,
  unregisterViewInstance,
} from "@manyducks.co/dolla/hmr";
```

- `__dolla_export(id, view)` wraps a view or store so updates can be matched to it. It returns the same wrapper every time it is called with the same `id`, which is what keeps stores' identity across reloads.
- `__dolla_store(id, store)` gives a store function the same store identity as the wrapper for `id`, and returns it. Use it on store arguments (`getStore(c, __dolla_store(id, AuthStore))`) when a function can be used as a store before `__dolla_export` has wrapped it.
- `registerViewInstance(view, node)` registers a mounted `ViewNode` so it can be replaced.
- `unregisterViewInstance(view, node)` removes the registration on unmount.
- `__dolla_apply(newModule, exports)` applies the updated view exports to matching instances.

## Limitations

- State local to a replaced view is lost. Move state you want to survive into a store or a context outside the replaced view.
- A full page reload discards all application state, as expected.
- HMR only applies to view modules; changes to stores, utility modules, or global CSS may trigger a full reload depending on your bundler setup.
