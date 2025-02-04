// States
export { createState, derive, isState, toState, toValue } from "./core/state.js";
export type { MaybeState, Setter, State, StopFunction } from "./core/state.js";

// Ref
export { createRef, isRef, type Ref } from "./core/ref.js";

// Equality checks (useful for states)
export { deepEqual, shallowEqual, strictEqual } from "./utils.js";

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
export type { ViewContext, ViewElement, ViewFunction } from "./core/nodes/view.js";
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";
export type { InputType, Renderable } from "./types.js";
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
