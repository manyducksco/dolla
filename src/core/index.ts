// Root
export { createRoot } from "./root.js";
export type { DollaPlugin } from "./root.js";

export { mount, type MountOptions } from "./mount.js";

// Signals
export { signal, batch, cleanup, effect, getter, memo, peek, state, subscribe } from "./signals.js";
export type { Getter, Setter, Accessor } from "./signals.js";

// Context & Hooks
export { Context } from "./context.js";
export * from "./hooks.js";

// Markup
export { repeat, show } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export type { Markup, MarkupNode } from "./markup/types.js";
export { createMarkup, render, toMarkupNodes } from "./markup/utils.js";

// Built-in Views
// export { For, type ForProps } from "./views/for.js";
// export { Fragment, type FragmentProps } from "./views/fragment.js";
// export { Portal, type PortalProps } from "./views/portal.js";
// export { Show, type ShowProps } from "./views/show.js";

// Ref
export { EmptyRefError, ref, type Ref } from "./ref.js";

// Debug
export { Debug, type LogLevel } from "./debug.js";

// Web Components
// export { ElementWithAttrs } from "./element.js";

// Other types
export type { CSSProperties, Env, InputType, Renderable, Store, View } from "../types.js";

import type { IntrinsicElements as Elements } from "../types.js";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: `${string}-${string}`]: any;
    }
  }
}
