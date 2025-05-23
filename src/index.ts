// Signals
export { $, effect, get, peek } from "./core/signals-api.js";
export type { MaybeSignal, Signal, Source } from "./core/signals-api.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "./utils.js";

// Store
export { type StoreContext, type StoreFunction } from "./core/store.js";

// Router
export { createRouter, type Router, type RouterOptions } from "./router/index.js";

// Markup
export { markup, portal, repeat, unless, when } from "./core/markup.js";
export type { Markup, MarkupElement } from "./core/markup.js";

import { Dolla } from "./core/dolla.js";
const dolla = new Dolla();

export default dolla;

export const t = dolla.i18n.t.bind(dolla.i18n);
export const i18n = dolla.i18n;
export const http = dolla.http;

export const createLogger = dolla.createLogger.bind(dolla);

// Other types
export type { Dolla, Environment, Logger, LoggerErrorContext, LoggerOptions, Loggles } from "./core/dolla.js";
export type { ViewContext, ViewElement, ViewFunction } from "./core/nodes/view.js";
// export type { HTTPRequest, HTTPResponse } from "./modules/http.js";
export type { CrashViewProps } from "./core/views/default-crash-view.js";
export type { InputType, Renderable } from "./types.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
