// Reactive
export { atom, compose, effect, get, set, peek, untrack, getTracked } from "./core/signals.js";
export type { Reactive, MaybeReactive, Atom } from "./core/signals.js";

// Equality checks
export { deepEqual, shallowEqual, strictEqual } from "./utils.js";

// Ref
export { ref, type Ref } from "./core/ref.js";

// Store
export { type StoreFunction, type StoreContext } from "./core/store.js";

// Router
export { createRouter, type Router, type RouterOptions } from "./router/index.js";

// Markup
export { cond, createMarkup, html, portal, list } from "./core/markup.js";
export type { Markup, MarkupElement } from "./core/markup.js";

import { Dolla } from "./core/dolla.js";
const dolla = new Dolla();

export default dolla;

export const t = dolla.i18n.t.bind(dolla.i18n);
export const http = dolla.http;

export const createLogger = dolla.createLogger.bind(dolla);

// Other types
export type { Dolla, Environment, Logger, LoggerErrorContext, LoggerOptions, Loggles } from "./core/dolla.js";
export type { ViewContext, ViewElement, ViewFunction } from "./core/nodes/view.js";
// export type { HTTPRequest, HTTPResponse } from "./modules/http.js";
export type { InputType, Renderable } from "./types.js";
export type { CrashViewProps } from "./core/views/default-crash-view.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
