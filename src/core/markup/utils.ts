import { isFunction, isNumber, isString } from "../../typeChecking.js";
import type { Renderable, View } from "../../types.js";
import { Context } from "../context/context.js";
import { computed, isReactive, reader } from "../reactive.js";
import { NodeType, MarkupNodeProps, Markup, MarkupNode } from "./markup.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { PortalNode } from "./nodes/portal.js";
import { RepeatNode } from "./nodes/repeat.js";
import { ViewNode } from "./nodes/view.js";

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
      if (isNumber(item.type)) {
        switch (item.type) {
          case NodeType.DOM: {
            const props = item.props as MarkupNodeProps[NodeType.DOM];
            nodes.push(new DOMNode(props.node));
            continue;
          }
          case NodeType.Dynamic: {
            const props = item.props as MarkupNodeProps[NodeType.Dynamic];
            nodes.push(new DynamicNode(context, props.slot));
            continue;
          }
          case NodeType.Element: {
            const props = item.props as MarkupNodeProps[NodeType.Element];
            nodes.push(new ElementNode(context, props.tag, props.props));
            continue;
          }
          case NodeType.Portal: {
            const props = item.props as MarkupNodeProps[NodeType.Portal];
            nodes.push(new PortalNode(context, props.parent, props.content));
            continue;
          }
          case NodeType.Repeat: {
            const props = item.props as MarkupNodeProps[NodeType.Repeat];
            nodes.push(new RepeatNode(context, props.items, props.key, props.render));
            continue;
          }
          case NodeType.View: {
            const props = item.props as MarkupNodeProps[NodeType.View];
            nodes.push(new ViewNode(context, props.view, props.props));
            continue;
          }
        }
      }

      if (isFunction(item.type)) {
        nodes.push(new ViewNode(context, item.type as View<any>, item.props));
        continue;
      }

      if (isString(item.type)) {
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
