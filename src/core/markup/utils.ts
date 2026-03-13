import type { Renderable, View } from "../../types.js";
import { isArray, isFunction, isNumber, isString } from "../../utils.js";
import { Context, createContext } from "../context.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { ViewNode } from "./nodes/view.js";
import { IS_MARKUP, IS_MARKUP_NODE, IS_MARKUP_NODE_CLASS, Markup, MarkupNode, MountTarget, PropsOf } from "./types.js";

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
  return value && value[IS_MARKUP];
}

export function isMarkupNode(value: any): value is MarkupNode {
  return value && value[IS_MARKUP_NODE];
}

export function isMarkupNodeClass(value: any): value is new (...args: any[]) => MarkupNode {
  return value && value[IS_MARKUP_NODE_CLASS];
}

/**
 * Takes any `Renderable` value and returns a `MarkupNode` that will display it.
 */
export function render(content: Renderable, context = createContext()): MarkupNode {
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

    if (isArray(item)) {
      for (let i = 0; i < item.length; i++) {
        process(item[i]);
      }
    } else if (isString(item) || isNumber(item)) {
      nodes.push(new DOMNode(context, createTextNode(String(item))));
    } else if (isMarkup(item)) {
      const { type, props } = item;

      if (isMarkupNodeClass(type)) {
        nodes.push(new type(context, ...props.args));
      } else if (isFunction(type)) {
        nodes.push(new ViewNode(context, type as View<any>, props));
      } else if (isString(type)) {
        nodes.push(new ElementNode(context, type, props));
      }
    } else if (isMarkupNode(item)) {
      nodes.push(item);
    } else if (item instanceof Node) {
      nodes.push(new DOMNode(context, item));
    } else if (isFunction(item)) {
      nodes.push(new DynamicNode(context, item));
    }
  }

  for (let i = 0; i < content.length; i++) {
    process(content[i]);
  }

  return nodes;
}

export function addChild(parent: MountTarget, node: Node, after?: Node | null) {
  if (after) {
    parent.insertBefore(node, after?.nextSibling);
  } else {
    parent.appendChild(node);
  }
}

export function createTextNode(text: string) {
  return document.createTextNode(text);
}

/**
 * Moves an element using `moveBefore` if the browser supports it, otherwise falls back to `insertBefore`.
 */
export function moveAfter(parent: MountTarget, node: Node, after?: Node | null) {
  const before = after?.nextSibling ?? null;
  if (parent.moveBefore) {
    parent.moveBefore(node, before);
  } else {
    parent.insertBefore(node, before);
  }
}

export function addListener<T extends Event>(target: EventTarget, event: string, listener: (event: T) => any) {
  target.addEventListener(event, listener as any);
  return () => target.removeEventListener(event, listener as any);
}
