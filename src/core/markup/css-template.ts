import type { MaybeGetter } from "../../types.js";
import type { Context } from "../context.js";

const IS_CSS_TEMPLATE = Symbol.for("$_IS_CSS_TEMPLATE");
const IS_CONDITIONAL_TEMPLATE = Symbol.for("$_IS_CONDITIONAL_TEMPLATE");
const IS_STYLED_VIEW: unique symbol = Symbol.for("$_IS_STYLED_VIEW");

/**
 * A template for a CSS snippet. Built when applied to an element.
 */
export type CSSTemplate = {
  [IS_CSS_TEMPLATE]: true;
  className: string;

  attach(c: Context, element: HTMLElement | SVGElement, condition?: MaybeGetter<any>): void;
  when(condition: MaybeGetter<any>): ConditionalTemplate;

  toString(): string;
};

/**
 * A wrapper around a CSSTemplate that conditionally applies it.
 */
export type ConditionalTemplate = {
  [IS_CONDITIONAL_TEMPLATE]: true;
  template: CSSTemplate;
  condition: MaybeGetter<any>;
};

/**
 * A styled view that can be interpolated into a CSS template as a selector.
 * The underlying template supplies the class name; the view is never rendered
 * as a value in the stylesheet.
 */
export type StyledTemplate = {
  [IS_STYLED_VIEW]: CSSTemplate;
};

export { IS_CONDITIONAL_TEMPLATE, IS_CSS_TEMPLATE, IS_STYLED_VIEW };

export function isCSSTemplate(value: any): value is CSSTemplate {
  return value != null && value[IS_CSS_TEMPLATE] === true;
}

export function isConditionalTemplate(value: any): value is ConditionalTemplate {
  return value != null && value[IS_CONDITIONAL_TEMPLATE] === true;
}

export function isStyledTemplate(value: any): value is StyledTemplate {
  return value != null && typeof value === "function" && value[IS_STYLED_VIEW] != null;
}
