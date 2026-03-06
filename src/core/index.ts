// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

// Reactive
export { batch, effect, getter, memo, peek, state, subscribe } from "./reactive.js";
export type { Getter, MaybeGetter, Reactive, Setter } from "./reactive.js";

// Context
export type { Context } from "./context.js";

// Hooks
export * from "./hooks.js";

// Markup
export { each, when } from "./markup/helpers.js";
export type { Markup, MarkupNode, NodeType } from "./markup/types.js";
export { createMarkup, render, toMarkupNodes } from "./markup/utils.js";

// ref
export { EmptyRefError, ref } from "./ref.js";
export type { Ref } from "./ref.js";

// html
export { html } from "./markup/html.js";

// Built-in Views
// export { For, type ForProps } from "./views/for.js";
export { Portal, type PortalProps } from "./views/portal.js";
// export { Show, type ShowProps } from "./views/show.js";
export { Fragment, type FragmentProps } from "./views/fragment.js";

// Logger
export { createLogger } from "./logger.js";
export type { Logger, LoggerOptions, LogLevel } from "./logger.js";

// Other types
export type { CSSProperties, Env, InputType, Mixin, Renderable, Store, View } from "../types.js";
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
