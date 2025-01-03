// App
export { App } from "./app.js";

export * from "./signals.js";

// Markup
export { type Ref, isRef, ref, m, cond, repeat, portal } from "./markup.js";

// Views
export { Fragment } from "./views/fragment.js";
export { StoreScope, type StoreScopeProps } from "./views/store-scope.js";

// Stores
export { RouterStore, type RouteMatchContext } from "./stores/router.js";
export { LanguageStore } from "./stores/language.js";
export { HTTPStore, type HTTPMiddleware } from "./stores/http.js";
export { DialogStore, type DialogProps } from "./stores/dialog.js";

// Types
export type { ViewContext } from "./view.js";
export type { StoreContext } from "./store.js";
export type { Markup } from "./markup.js";
export type { InputType, Renderable } from "./types.js";
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
