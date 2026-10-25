import type { MaybeGetter } from "../../types.js";
import type { Context } from "../context.js";

const IS_CSS_TEMPLATE = Symbol.for("$_IS_CSS_TEMPLATE");
const IS_CONDITIONAL_TEMPLATE = Symbol.for("$_IS_CONDITIONAL_TEMPLATE");

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

export { IS_CONDITIONAL_TEMPLATE, IS_CSS_TEMPLATE };

export function isCSSTemplate(value: any): value is CSSTemplate {
  return value != null && value[IS_CSS_TEMPLATE] === true;
}

export function isConditionalTemplate(value: any): value is ConditionalTemplate {
  return value != null && value[IS_CONDITIONAL_TEMPLATE] === true;
}
