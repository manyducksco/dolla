// Signals
export { $, effect, get, peek } from "./signals.js";
export type { MaybeSignal, Signal, Source } from "./signals.js";

// Ref
export { ref, type Ref } from "./ref.js";

export { constructView } from "./nodes/view.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "../utils.js";

// Store
export { Stores, type StoreContext, type StoreFunction } from "./store.js";

// Markup
export { markup, portal, repeat, unless, when, constructMarkup } from "./markup.js";
export type { Markup, MarkupElement } from "./markup.js";

// Env
export { getEnv, setEnv } from "./env.js";
export type { Env } from "./env.js";

// Logger
export { createLogger, setLogFilter, setLogLevels } from "./logger.js";
export type { Logger, LoggerErrorContext, LoggerOptions, LogLevels } from "./logger.js";

// Mount
export { mount, type UnmountFn } from "./mount.js";

// Other types
export type { ViewContext, ViewElement, ViewFunction } from "./nodes/view.js";
export type { CrashViewProps } from "./views/default-crash-view.js";
export type { InputType, Renderable } from "../types.js";

import type { IntrinsicElements as Elements } from "../types.js";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
