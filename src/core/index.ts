// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Signals
export { batch, compose, createAtom, createSetter, peek, unwrap } from "./signals.js";
export type { Getter, MaybeGetter, Setter } from "./signals.js";

// Hooks
export { addStore, getStore, hasOwnStore, hasStore, isMounted, onCleanup, onEffect, onMount } from "./context.js";
export type { Context } from "./context.js";

// Debug
export { createDebug, getDebug, setLogFilter, setLogLevel } from "./debug.js";

// Markup
export { branch, createPortal, hideIf, repeat, showIf } from "./markup/helpers.js";
export type { BranchTuple } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export { css } from "./markup/css.js";
export { transition } from "./markup/transition.js";

// Ref
export { createRef } from "./ref.js";
export type { Ref } from "./ref.js";

// Temporal Control Flow
export { debounce } from "./debounce.js";
export { throttle } from "./throttle.js";
export { sleep } from "../utils.js";

// Other types
export type { Renderable, Store, View } from "../types.js";

import type { IntrinsicElements as Elements } from "../types.js";
declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      [tag: `${string}-${string}`]: any; // Catch all for custom elements
      [tag: string]: any; // Catch-all for as-yet-undefined elements (SVG)
    }
  }
}
