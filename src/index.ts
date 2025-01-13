// signals

export {
  createSettableSignal,
  createSignal,
  createSignalSetter,
  derive,
  designalify,
  signalify,
  toSettableSignal,
  watch,
} from "./signals.js";
export type { MaybeSignal, SettableSignal, Signal, StopFunction } from "./signals.js";

import { Dolla } from "./modules/dolla.js";

const dolla = new Dolla();

// export const beforeMount = dolla.beforeMount.bind(dolla);
// export const onMount = dolla.onMount.bind(dolla);
// export const beforeUnmount = dolla.beforeUnmount.bind(dolla);
// export const onUnmount = dolla.onUnmount.bind(dolla);
// export const mount = dolla.mount.bind(dolla);
// export const unmount = dolla.unmount.bind(dolla);

// module: http
// export const http = dolla.http;

// module: render
// export const render = dolla.render;

// module: logging
// export const createLogger = dolla.createLogger.bind(dolla);
// export const setLogFilter = dolla.setLogFilter.bind(dolla);
// export const setLoggles = dolla.setLoggles.bind(dolla);

// module: language
export const t = dolla.language.t.bind(dolla.language);

// Markup
export { html, cond, createMarkup, portal, repeat, createRef, isRef } from "./markup.js";
export type { Markup, MarkupNode, Ref } from "./markup.js";

// Views
export type { ViewFunction, ViewContext, ViewNode } from "./view.js";
export type { CrashViewProps } from "./views/default-crash-view.js";

// export const constructView = dolla.constructView.bind(dolla);

// Types
export type { InputType, Renderable } from "./types.js";
export type { Environment } from "./modules/dolla.js";
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}

export default dolla;
