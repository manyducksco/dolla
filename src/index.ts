// signals

export {
  createSignal,
  derive,
  watch,
  signalify,
  designalify,
  createSettableSignal,
  toSettableSignal,
  createSignalSetter,
} from "./signals.js";
export type { Signal, MaybeSignal, SettableSignal, StopFunction } from "./signals.js";

import { Dolla } from "./modules/dolla.js";
export type { Environment } from "./modules/dolla.js";

const dolla = new Dolla();

export const beforeMount = dolla.beforeMount.bind(dolla);
export const onMount = dolla.onMount.bind(dolla);
export const beforeUnmount = dolla.beforeUnmount.bind(dolla);
export const onUnmount = dolla.onUnmount.bind(dolla);
export const mount = dolla.mount.bind(dolla);
export const unmount = dolla.unmount.bind(dolla);

// export { setEnv, getEnv, beforeMount, onMount, beforeUnmount, onUnmount, mount, unmount } from Core;

// module: http
export const http = dolla.http;
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";

// module: render
export const render = dolla.render;

// module: logging
export const createLogger = dolla.createLogger.bind(dolla);
export const setLogFilter = dolla.setLogFilter.bind(dolla);
export const setLogges = dolla.setLoggles.bind(dolla);

// module: language
export const t = dolla.language.t.bind(dolla.language);

// module: router
import * as router from "./modules/router.js";
export { router };

// Markup
import { createRef, isRef } from "./markup.js";
export { type Ref, createMarkup as m, cond, repeat, portal } from "./markup.js";
export { createRef, isRef };
export type { DOMHandle } from "./markup.js";

// Views
export type { ViewFunction } from "./view.js";
export { Fragment } from "./views/fragment.js";

export const constructView = dolla.constructView.bind(dolla);

// Types
export type { ViewContext } from "./view.js";
export type { Markup } from "./markup.js";
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

export default dolla;
