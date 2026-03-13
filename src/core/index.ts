// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Signals
export { batch, effect, get, memo, peek, state, subscribe } from "./signals.js";
export type { Accessor, Getter, Setter } from "./signals.js";

// Hooks
export { addStore, onCleanup, onEffect, onMount, useStore } from "./context.js";
export type { Context } from "./context.js";

// Debug
export { setLogFilter, setLogLevel, useDebug } from "./debug.js";

// Markup
export { portal, each, when } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export type { Markup, MarkupNode } from "./markup/types.js";
export { createMarkup } from "./markup/utils.js";

// Ref
export { ref } from "./ref.js";
export type { Ref } from "./ref.js";

// TESTING
// export * from "../http";
// export * from "../router";
// export * from "../translate";
// export * from "../virtual";

// Other types
export type { CSSProperties, Env, InputType, Renderable, Store, View } from "../types.js";

import type { IntrinsicElements as Elements } from "../types.js";
declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      [tag: `${string}-${string}`]: any; // Catch all for custom elements
    }
  }
}
