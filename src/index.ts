// App
export { makeApp } from "./app.js";

// State
export { spring } from "./spring.js";
export { readable, writable, computed, proxy, observe, unwrap, isReadable, isWritable } from "./state.js";

// Markup
export { m, cond, repeat, portal } from "./markup.js";

// Views
export { Fragment } from "./views/fragment.js";
export { StoreScope } from "./views/store-scope.js";

// Types
export type { DialogProps } from "./stores/dialog.js";
export type { StoreScopeProps } from "./views/store-scope.js";
export type { Spring } from "./spring.js";
export type { Readable, Writable } from "./state.js";
export type { ViewContext } from "./view.js";
export type { StoreContext } from "./store.js";
export type { Markup } from "./markup.js";
export type { HTTPMiddleware } from "./stores/http.js";
export type { InputType } from "./types.js";
// export "./types.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
