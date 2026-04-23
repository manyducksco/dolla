// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Signals
export { batch, compose, createAtom, createEffect, peek, subscribe, unwrap } from "./signals.js";
export type { Getter, Setter } from "./signals.js";

// Hooks
export { addStore, getStore, onCleanup, onEffect, onMount } from "./context.js";
export type { Context } from "./context.js";

// Debug
export { createDebug, getDebug, setLogFilter, setLogLevel } from "./debug.js";

// Markup
export { forEach, showIf, hideIf, createPortal } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export { ViewNode } from "./markup/nodes/view.js";
export type { Markup, MarkupNode } from "./markup/types.js";
export { createMarkup, render } from "./markup/utils.js";

// Ref
export { createRef } from "./ref.js";
export type { Ref } from "./ref.js";

// Other types
export type { CSSProperties, Env, InputType, MaybeGetter, Renderable, Store, View } from "../types.js";

import type { IntrinsicElements as Elements } from "../types.js";
declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      [tag: `${string}-${string}`]: any; // Catch all for custom elements
      [tag: string]: any; // Catch-all for as-yet-undefined elements (SVG)
    }
  }
}
