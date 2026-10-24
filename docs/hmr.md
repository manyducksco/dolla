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

- `__dolla_export(id, view)` wraps a view so updates can be matched to it.
- `registerViewInstance(view, node)` registers a mounted `ViewNode` so it can be replaced.
- `unregisterViewInstance(view, node)` removes the registration on unmount.
- `__dolla_apply(newModule, exports)` applies the updated view exports to matching instances.

## Limitations

- State local to a replaced view is lost. Move state you want to survive into a store or a context outside the replaced view.
- A full page reload discards all application state, as expected.
- HMR only applies to view modules; changes to stores, utility modules, or global CSS may trigger a full reload depending on your bundler setup.
