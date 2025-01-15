// Signals
export {
  createSettableSignal,
  createSignal,
  createSignalSetter,
  derive,
  designalify,
  signalify,
  toSettableSignal,
  // watch, // don't export as standalone function to discourage accidentally using it in a view?
} from "./signals.js";
export type { MaybeSignal, SettableSignal, Signal, StopFunction } from "./signals.js";

// Markup
export { cond, createMarkup, createRef, html, isRef, portal, repeat } from "./markup.js";
export type { Markup, MarkupNode, Ref } from "./markup.js";

import { Dolla } from "./modules/dolla.js";
const dolla = new Dolla();

export default dolla;

// Language: standalone `t` function
export const t = dolla.language.t.bind(dolla.language);

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
