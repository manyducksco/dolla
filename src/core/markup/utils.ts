import { isFunction } from "../../typeChecking.js";
import type { Renderable, View } from "../../types.js";
import { Context } from "../context.js";
import { computed, isReactive, reader } from "../reactive.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { PortalNode } from "./nodes/portal.js";
import { RepeatNode } from "./nodes/repeat.js";
import { ViewNode } from "./nodes/view.js";
import { IS_MARKUP, IS_MARKUP_NODE, Markup, MarkupNode, MarkupNodeProps, NodeType, PropsOf } from "./types.js";

export function createMarkup<Type extends string | NodeType | View<any>>(
  type: Type,
  props: PropsOf<Type>,
): Markup<Type> {
  return {
    $$kind: IS_MARKUP,
    type,
    props,
  };
}

export function isMarkup<T extends string | NodeType | View<any>>(value: any): value is Markup<T> {
  return value != null && value.$$kind === IS_MARKUP;
}

export function isMarkupNode(value: any): value is MarkupNode {
  return value != null && value[IS_MARKUP_NODE] === true;
}

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
  // otherwise wrap it in something that can display multiple nodes
  return new DynamicNode(context, reader(nodes));
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

    if (typeof item === "string" || typeof item === "number") {
      nodes.push(new DOMNode(document.createTextNode(String(item))));
      return;
    }

    if (item && item.$$kind === IS_MARKUP) {
      const { type, props } = item;

      if (typeof type === "function") {
        nodes.push(new ViewNode(context, type as View<any>, props));
        return;
      }

      if (typeof type === "string") {
        // starts with "$"
        if (type.charCodeAt(0) === 36) {
          switch (type) {
            case "$dom":
              nodes.push(new DOMNode((props as MarkupNodeProps["$dom"]).node));
              return;
            case "$dynamic":
              nodes.push(new DynamicNode(context, (props as MarkupNodeProps["$dynamic"]).slot));
              return;
            case "$element": {
              const p = props as MarkupNodeProps["$element"];
              nodes.push(new ElementNode(context, p.tag, p.props));
              return;
            }
            case "$portal": {
              const p = props as MarkupNodeProps["$portal"];
              nodes.push(new PortalNode(context, p.parent, p.content));
              return;
            }
            case "$repeat": {
              const p = props as MarkupNodeProps["$repeat"];
              nodes.push(new RepeatNode(context, p.items, p.key, p.render));
              return;
            }
            case "$view": {
              const p = props as MarkupNodeProps["$view"];
              nodes.push(new ViewNode(context, p.view, p.props));
              return;
            }
          }
        }

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
      nodes.push(new DOMNode(item));
      return;
    }

    if (isReactive(item)) {
      nodes.push(new DynamicNode(context, item));
      return;
    }

    if (typeof item === "function") {
      nodes.push(new DynamicNode(context, computed(item)));
      return;
    }

    // Fallback for unhandled objects
    nodes.push(new DOMNode(document.createTextNode(String(item))));
  }

  for (let i = 0; i < content.length; i++) {
    process(content[i]);
  }

  return nodes;
}
