import { isFunction, isNumber, isString } from "../typeChecking.js";
import type { IntrinsicElements, Renderable, View } from "../types.js";
import { Context } from "./context.js";
import { MarkupNode } from "./nodes/_markup.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { ViewNode } from "./nodes/view.js";
import { type Reactive, computed, isReactive, reader } from "./reactive.js";

export { MarkupNode };

/*===========================*\
||           Markup          ||
\*===========================*/

type PropsOf<V extends string | number | View<any>> = V extends View<infer U> ? U : any;

/**
 * `Markup` is a set of metadata that will be constructed into a `MarkupNode`.
 */
export class Markup<Type extends string | number | View<any> = string | number | View<any>> {
  /**
   * In the case of a view, type will be the View function itself. It can also hold an identifier for special nodes like "$cond", "$repeat", etc.
   * DOM nodes can be created by name, such as HTML elements like "div", "ul" or "span", SVG elements like ""
   */
  type;

  /**
   * Data that will be passed to a new MarkupNode instance when it is constructed.
   * Includes a `children` prop if children were passed.
   */
  props;

  constructor(type: Type, props: PropsOf<Type>) {
    this.type = type;
    this.props = props;
  }
}

export enum DollaNode {
  Dynamic,
}

export const MARKUP_DYNAMIC = Symbol("DynamicNode");

export interface MarkupNodeProps {
  [DollaNode.Dynamic]: {
    source: Reactive<any>;
  };
}

export interface MarkupCustomElementProps {
  /**
   * Custom element tagName pattern (must include a hyphen).
   */
  [tag: `${string}-${string}`]: Record<string, any>;
}

/**
 * Creates a `Markup` element that defines an HTML element.
 */
export function createMarkup<T extends keyof IntrinsicElements>(
  tag: T,
  attrs: IntrinsicElements[T] & { children?: Renderable },
): Markup;

/**
 * Creates a `Markup` element that defines an HTML custom element.
 */
export function createMarkup<T extends keyof MarkupCustomElementProps>(
  type: T,
  props: MarkupCustomElementProps[T],
): Markup;

/**
 * Creates a `Markup` element that defines a `MarkupNode`.
 */
export function createMarkup<T extends keyof MarkupNodeProps>(type: T, props: MarkupNodeProps[T]): Markup;

/**
 * Creates a `Markup` element that defines a view.
 */
export function createMarkup<P extends {}>(type: View<P>, props?: P): Markup;

/**
 * Creates a `Markup` element that defines a view.
 */
export function createMarkup<P>(type: View<P>, props: P): Markup;

export function createMarkup(type: string | View<any>, props?: any) {
  return new Markup(type, props ?? {});
}

/*===========================*\
||           Render          ||
\*===========================*/

/**
 * Takes any `Renderable` value and returns a `MarkupNode` that will display it.
 */
export function render(content: Renderable, context = new Context("$")): MarkupNode {
  if (isFunction(content)) {
    return new ViewNode(context, content, {});
  }
  const nodes = toMarkupNodes(context, content);
  if (nodes.length === 1) {
    return nodes[0]; // if it's just one item return it
  }
  // otherwise wrap it in a DynamicNode
  return new DynamicNode(context, reader(nodes));
}

/**
 * Convert basically anything into an array of `MarkupNode`
 */
export function toMarkupNodes(context: Context, ...content: any[]): MarkupNode[] {
  const items = content.flat(Infinity);
  const nodes: MarkupNode[] = [];

  for (const item of items) {
    if (item === null || item === undefined || item === false) {
      continue;
    }

    if (item instanceof Node) {
      nodes.push(new DOMNode(item));
      continue;
    }

    if (item instanceof MarkupNode) {
      nodes.push(item);
      continue;
    }

    if (item instanceof Markup) {
      if (item.type === DollaNode.Dynamic) {
        const attrs = item.props! as MarkupNodeProps[DollaNode.Dynamic];
        nodes.push(new DynamicNode(context, attrs.source));
        continue;
      }

      if (isFunction(item.type)) {
        nodes.push(new ViewNode(context, item.type as View<any>, item.props));
        continue;
      }

      if (isString(item.type)) {
        // Assume `type` is an HTML/SVG tag.
        nodes.push(new ElementNode(context, item.type, item.props));
        continue;
      }

      throw new Error(`Unknown markup node type: ${item.type}`);
    }

    if (isReactive(item)) {
      nodes.push(new DynamicNode(context, item));
      continue;
    }

    if (isFunction(item)) {
      nodes.push(new DynamicNode(context, computed(item)));
      continue;
    }

    // fallback to displaying value as text
    nodes.push(new DOMNode(document.createTextNode(String(item))));
  }

  return nodes;
}
