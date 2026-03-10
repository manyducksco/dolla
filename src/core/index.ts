// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Signals
export { batch, effect, getter, memo, peek, state, subscribe, cleanup } from "./signals.js";
export type { Getter, MaybeGetter, Setter } from "./signals.js";

// Context & Hooks
export { type Core, Context } from "./context.js";
export * from "./hooks.js";

// Markup
export { each, when } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export type { Markup, MarkupNode, NodeType } from "./markup/types.js";
export { createMarkup, render, toMarkupNodes } from "./markup/utils.js";

// Built-in Views
export { For, type ForProps } from "./views/for.js";
export { Fragment, type FragmentProps } from "./views/fragment.js";
export { Portal, type PortalProps } from "./views/portal.js";
export { Show, type ShowProps } from "./views/show.js";

// Ref
export { EmptyRefError, ref, type Ref } from "./ref.js";

// Debug
export { debug, type LogLevel } from "./debug.js";

// Web Components
export { $adopted, $moved, element } from "./element.js";

// Other types
export type { CSSProperties, Env, InputType, Renderable, Store, View } from "../types.js";
// export type { CrashViewProps } from "./views/_default-crash-view.js";

import type { IntrinsicElements as Elements } from "../types.js";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
