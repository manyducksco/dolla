// Root
// export { createRoot } from "./root.js";
// export type { DollaPlugin } from "./root.js";

export { mount, type MountOptions } from "./mount.js";

// Signals
export { batch, cleanup, effect, getter, memo, peek, signal, state, subscribe } from "./signals.js";
export type { Accessor, Getter, Setter } from "./signals.js";

// Context & Hooks
export type { Context } from "./context.js";
export * from "./hooks.js";

// Markup
export { repeat, when, portal } from "./markup/helpers.js";
export { html } from "./markup/html.js";
export type { Markup, MarkupNode } from "./markup/types.js";
export { createMarkup, render, toMarkupNodes } from "./markup/utils.js";

// Ref
export { EmptyRefError, ref, type Ref } from "./ref.js";

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
