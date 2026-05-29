# Hot Module Replacement

Dolla supports HMR for view components during development. When using Vite, view functions are automatically replaced in active component instances without a full page reload.

## Setup

Add the Dolla Vite plugin to your `vite.config.js`:

```js
import { defineConfig } from "vite";
import dolla from "@manyducks.co/dolla/vite-plugin";

export default defineConfig({
  plugins: [dolla()],
});
```

The Vite plugin auto-injects HMR registration into exported view functions. When a module updates, active component instances receive the new view function and re-render in place.

If you're not using Vite, use the manual API:

```js
import { registerViewInstance, unregisterViewInstance, __dolla_apply } from "@manyducks.co/dolla/hmr";
```
