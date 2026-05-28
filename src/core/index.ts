// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Signals
export { batch, compose, createAtom, createEffect, createSetter, peek, subscribe, unwrap } from "./signals.js";
export type { Getter, Setter } from "./signals.js";

// Hooks
export { addStore, getNearestViewNode, getRootElement, getStore, onCleanup, onEffect, onMount } from "./context.js";
export { createContext, mountContext, cleanupContext } from "./context.js";
export type { Context } from "./context.js";

// Debug
export { createDebug, getDebug, setLogFilter, setLogLevel } from "./debug.js";

// Markup
export type { Markup, MarkupNode } from "./markup/types.js";
export { createPortal, forEach, hideIf, showIf } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export { css } from "./markup/css.js";
export { createMarkup, render } from "./markup/utils.js";
export { DOMNode } from "./markup/nodes/dom.js";
export { DynamicNode } from "./markup/nodes/dynamic.js";
export { ElementNode } from "./markup/nodes/element.js";
export { PortalNode } from "./markup/nodes/portal.js";
export { RepeatNode } from "./markup/nodes/repeat.js";
export { ViewNode } from "./markup/nodes/view.js";

// Ref
export { createRef } from "./ref.js";
export type { Ref } from "./ref.js";

// Temporal Control Flow
export { debounce } from "./debounce.js";
export { throttle } from "./throttle.js";

// Type Helpers
export { createView, createStore } from "./helpers.js";

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
