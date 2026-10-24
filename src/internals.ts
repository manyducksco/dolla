// Rendering
export { createMarkup, render } from "./core/markup/utils.js";
export { DOMNode } from "./core/markup/nodes/dom.js";
export { DynamicNode } from "./core/markup/nodes/dynamic.js";
export { ElementNode } from "./core/markup/nodes/element.js";
export { PortalNode } from "./core/markup/nodes/portal.js";
export { RepeatNode } from "./core/markup/nodes/repeat.js";
export { ViewNode } from "./core/markup/nodes/view.js";

// Context
export {
  createContext,
  mountContext,
  cleanupContext,
  getNearestViewNode,
  getRootElement,
} from "./core/context.js";

// Signals
export { createEffect, subscribe } from "./core/signals.js";

// Types
export type { Markup, MarkupNode } from "./core/markup/types.js";
export type {
  CoreCSSSyntax,
  CSSSyntaxDescriptor,
  Interpolation,
  InterpolationValue,
  PropertyConfig,
} from "./core/markup/css.js";
export type { CSSProperties, InputType } from "./types.js";
