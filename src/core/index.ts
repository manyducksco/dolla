// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Reactive
export {
  batch,
  computed,
  get,
  isMutable,
  isReactive,
  nextValue,
  reader,
  state,
  subscribe,
  track,
  transform,
  watch,
} from "./reactive.js";
export type { Gettable, Getter, MaybeGetter, MaybeReadable, Mutable, Reactive } from "./reactive.js";

// Context
export type { Context } from "./context/context.js";

// Ref
export { ref, type Ref } from "./ref.js";

// Hooks
export * from "./hooks.js";

// Markup
export { Markup, MarkupNode, render, toMarkupNodes, NodeType } from "./markup/index.js";

// html
export { html } from "./markup/html.js";

// Built-in Views
export { For, type ForProps } from "./views/for.js";
export { Portal, type PortalProps } from "./views/portal.js";
export { Show, type ShowProps } from "./views/show.js";
export { Boundary, type BoundaryProps } from "./views/boundary.js";
export { Fragment, type FragmentProps } from "./views/fragment.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "../utils.js";

// Logger
export { createLogger } from "./context/logger.js";
export type { Logger, LoggerOptions, LogLevel } from "./context/logger.js";

// Other types
export type { CSSProperties, Env, InputType, Mixin, Renderable, Store, View } from "../types.js";
export type { CrashViewProps } from "./views/_default-crash-view.js";

import type { IntrinsicElements as Elements } from "../types.js";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
