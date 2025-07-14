// App
export { createApp } from "./app.js";

// Signals
export { $, batch, effect, get, memo as memo, writable, untracked } from "./signals.js";
export type { MaybeSignal, Writable, Signal } from "./signals.js";

// Context
export { createContext } from "./context.js";
export type { Context } from "./context.js";

// Markup
export { m, Markup, MarkupNode, portal, render, repeat, unless, when } from "./markup.js";

// Ref
export { ref, type Ref } from "./ref.js";

// Built-in Views
export { For, type ForProps } from "./views/for.js";
export { Show, type ShowProps } from "./views/show.js";
export { Portal, type PortalProps } from "./views/portal.js";

// Mount
// export { mount, type UnmountFn } from "./mount.js";

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
