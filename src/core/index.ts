// App
export { createApp } from "./app.js";

// Signals
export { batch, effect, get, memo, readable, signal, untracked, writable } from "./signals.js";
export type { MaybeSignal, Signal, Writable, Setter } from "./signals.js";

// Hooks
export * from "./hooks.js";

// Context
export { createContext } from "./context.js";
export type { Context } from "./context.js";

// Markup
export { createMarkup, Markup, MarkupNode, render } from "./markup.js";

// Ref
export { ref, type Ref } from "./ref.js";

// Built-in Views
export { For, type ForProps } from "./views/for.js";
export { Portal, type PortalProps } from "./views/portal.js";
export { Show, type ShowProps } from "./views/show.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "../utils.js";

// Env
export { getEnv, setEnv } from "./env.js";

// Logger
export { createLogger, onLoggerCrash, setLogFilter, setLogLevels } from "./logger.js";
export type { Logger, LoggerCrashProps, LoggerOptions, LogLevels } from "./logger.js";

// Other types
export type { CSSProperties, Env, InputType, Mixin, Renderable, Store, View } from "../types.js";
export type { CrashViewProps } from "./views/default-crash-view.js";

import type { IntrinsicElements as Elements } from "../types.js";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
