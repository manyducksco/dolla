import type { Renderable, View } from "../../types.js";
import { isFunction, isNumber, isString } from "../../utils.js";
import { Context } from "../context.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { ViewNode } from "./nodes/view.js";
import { IS_MARKUP, IS_MARKUP_NODE, Markup, MarkupNode, PropsOf } from "./types.js";

export function createMarkup<Type extends string | View<any> | (new (...args: any[]) => MarkupNode)>(
  type: Type,
  props: PropsOf<Type>,
): Markup<Type> {
  return {
    [IS_MARKUP]: true,
    type,
    props,
  };
}

export function isMarkup<T extends string | View<any> | (new (...args: any[]) => MarkupNode)>(
  value: any,
): value is Markup<T> {
  return value != null && value[IS_MARKUP] === true;
}

export function isMarkupNode(value: any): value is MarkupNode {
  return value != null && value[IS_MARKUP_NODE] === true;
}

export function isMarkupNodeClass(fn: any): fn is new (...args: any[]) => MarkupNode {
  return fn && fn.isMarkupNode === true;
}

/**
 * Takes any `Renderable` value and returns a `MarkupNode` that will display it.
 */
export function render(content: Renderable, context = new Context("$")): MarkupNode {
  const nodes = toMarkupNodes(context, content);
  if (nodes.length === 1) {
    return nodes[0]; // if it's just one item return it
  }
  // otherwise wrap it in something that can display multiple nodes
  return new DynamicNode(context, () => nodes);
}

/**
 * Convert basically anything into an array of `MarkupNode`
 */
export function toMarkupNodes(context: Context, ...content: any[]): MarkupNode[] {
  const nodes: MarkupNode[] = [];

  // Internal processor to avoid intermediate array allocations
  function process(item: any) {
    if (item == null || item === false) return;

    if (Array.isArray(item)) {
      for (let i = 0; i < item.length; i++) {
        process(item[i]);
      }
      return;
    }

    if (isString(item) || isNumber(item)) {
      nodes.push(new DOMNode(context, document.createTextNode(String(item))));
      return;
    }

    if (isMarkup(item)) {
      const { type, props } = item;

      if (isFunction(type)) {
        if (isMarkupNodeClass(type)) {
          nodes.push(new type(context, ...props.args));
          return;
        }

        nodes.push(new ViewNode(context, type as View<any>, props));
        return;
      }

      if (isString(type)) {
        nodes.push(new ElementNode(context, type, props));
        return;
      }

      throw new Error(`Unknown markup node type: ${type}`);
    }

    if (isMarkupNode(item)) {
      nodes.push(item);
      return;
    }

    if (item instanceof Node) {
      nodes.push(new DOMNode(context, item));
      return;
    }

    if (isFunction(item)) {
      nodes.push(new DynamicNode(context, item));
      return;
    }

    // Fallback to printing unhandled objects
    const pre = document.createElement("pre");
    pre.textContent = JSON.stringify(item, null, 2);
    nodes.push(new DOMNode(context, pre));
  }

  for (let i = 0; i < content.length; i++) {
    process(content[i]);
  }

  return nodes;
}
