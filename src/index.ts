// States
export { createSettableState, createSetter, createState, derive, toSettableState, toState, valueOf } from "./state.js";
export type { MaybeState, SettableState, State, StopFunction } from "./state.js";

// Markup
export { cond, createMarkup, createRef, html, isRef, portal, repeat } from "./markup.js";
export type { Markup, MarkupNode, Ref } from "./markup.js";

import { Dolla } from "./modules/dolla.js";
const dolla = new Dolla();

export default dolla;

// Language: standalone `t` function
export const t = dolla.i18n.t.bind(dolla.i18n);

// Other types
export type { Dolla, Environment, Logger, LoggerErrorContext, LoggerOptions, Loggles } from "./modules/dolla.js";
export type { HTTPRequest, HTTPResponse } from "./modules/http.js";
export type { InputType, Renderable } from "./types.js";
export type { ViewContext, ViewFunction, ViewNode } from "./view.js";
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
