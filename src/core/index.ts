// App
export { dolla } from "./app.js";

// Signals
export { batch, computed, isReadable, isWritable, nextValue, read, state, toReadable, track, watch } from "./signal.js";
export type { Gettable, Getter, MaybeGetter, MaybeReadable, Readable, Writable } from "./signal.js";

// Hooks
export * from "./hooks.js";

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
export { createLogger, onLoggerCrash } from "./logger.js";
export type { Logger, LoggerCrashProps, LoggerOptions, LogLevel } from "./logger.js";

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
