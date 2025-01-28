// States
export {
  createRef,
  createSettableState,
  createSetter,
  createState,
  derive,
  isRef,
  toSettableState,
  toState,
  valueOf,
} from "./core/state.js";
export type { MaybeState, Ref, SettableState, State, StopFunction } from "./core/state.js";

// Equality checks (useful for states)
export { strictEqual, shallowEqual, deepEqual } from "./utils.js";

// Markup
export { cond, createMarkup, html, portal, repeat } from "./core/markup.js";
export type { Markup, MarkupElement } from "./core/markup.js";

import { Dolla } from "./core/dolla.js";
const dolla = new Dolla();

export default dolla;

// Language: standalone `t` function
export const t = dolla.i18n.t.bind(dolla.i18n);

export function setDevDebug(value: boolean) {
  if (typeof window !== "undefined") {
    (window as any).DOLLA_DEV_DEBUG = value;
  }
}

export function getDevDebug(): boolean {
  if (typeof window !== "undefined") {
    return (window as any).DOLLA_DEV_DEBUG === true;
  }
  return false;
}

// Other types
export type { Dolla, Environment, Logger, LoggerErrorContext, LoggerOptions, Loggles } from "./core/dolla.js";
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";
export type { InputType, Renderable } from "./types.js";
export type { ViewContext, ViewFunction, ViewElement as ViewNode } from "./core/view.js";
export type { CrashViewProps } from "./views/default-crash-view.js";

import type { IntrinsicElements as Elements } from "./types";

declare global {
  namespace JSX {
    interface IntrinsicElements extends Elements {
      // Catch all for custom elements
      [tag: string]: any;
    }
  }
}
