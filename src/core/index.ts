// Signals
export { $, effect, get, untracked, batch } from "./signals.js";
export type { MaybeSignal, Signal, Source } from "./signals.js";

// Context
export { createContext } from "./context.js";
export type { Context } from "./context.js";

// Markup
export { m, portal, render, repeat, unless, when } from "./markup.js";
export type { MarkupNode } from "./markup.js";

// Ref
export { ref, type Ref } from "./ref.js";

// Mount
export { mount, type UnmountFn } from "./mount.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "../utils.js";

// Env
export { getEnv, setEnv } from "./env.js";

// Logger
export { createLogger, setLogFilter, setLogLevels, onLoggerCrash } from "./logger.js";
export type { Logger, LoggerCrashProps, LoggerOptions, LogLevels } from "./logger.js";

// Other types
export type { View, Store, Mixin, InputType, Renderable, Env, CSSProperties } from "../types.js";
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
