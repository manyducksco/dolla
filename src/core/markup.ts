import { isFunction, isString } from "../typeChecking.js";
import type { IntrinsicElements, Renderable, View } from "../types.js";
import { Context } from "./context.js";
import { MarkupNode } from "./nodes/_markup.js";
import { DOMNode } from "./nodes/dom.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ElementNode } from "./nodes/element.js";
import { PortalNode } from "./nodes/portal.js";
import { KeyFn, RenderFn, RepeatNode } from "./nodes/repeat.js";
import { ViewNode } from "./nodes/view.js";
import { $, get, type MaybeSignal, type Signal } from "./signals.js";

export { MarkupNode };

/*===========================*\
||           Markup          ||
\*===========================*/

/**
 * `Markup` is a set of metadata that will be constructed into a `MarkupNode`.
 */
export class Markup<P = any> {
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

  constructor(type: string | View<P>, props?: P) {
    this.type = type;
    this.props = props;
  }
}

/**
 * A node that can be mounted by the Markup layout engine.
 * Implemented by the built in nodes, but can of course also be implemented to create your own custom nodes.
 *
 * A `MarkupNode` instance can be passed anywhere a `Renderable` is required.
 */
// export interface MarkupNode {
//   /**
//    * A single DOM node to represent this MarkupNode's position in the DOM.
//    * Usually the parent element, but it can be an empty Text node used as a marker.
//    *
//    * It only needs to be defined while the node is mounted, so it can be created in the `mount` function.
//    */
//   readonly root?: Node;

//   /**
//    * Returns true while this MarkupNode is mounted.
//    */
//   isMounted(): boolean;

//   /**
//    * Mount this MarkupNode to a `parent` element.
//    * If passed, this MarkupNode will be mounted as the next sibling of `after`.
//    */
//   mount(parent: Element, after?: Node): void;

//   /**
//    * Unmount this MarkupNode from its parent element.
//    *
//    * The `skipDOM` option can be passed as an optimization when unmounting a parent node.
//    * A value of `true` indicates that no DOM operations need to happen because the parent is already being unmounted.
//    *
//    * @param skipDOM - No DOM updates will be performed when true. Lifecycle methods will be called regardless.
//    */
//   unmount(skipDOM?: boolean): void;

//   /**
//    * Moves a node without unmounting and remounting (if the browser supports Element.moveBefore).
//    */
//   move(parent: Element, after?: Node): void;
// }

export enum MarkupType {
  DOM = "$dom",
  Dynamic = "$dynamic",
  Portal = "$portal",
  Repeat = "$repeat",
}

export interface MarkupNodeProps {
  [MarkupType.DOM]: {
    value: Node;
  };
  [MarkupType.Dynamic]: {
    source: Signal<any>;
  };
  [MarkupType.Portal]: {
    content: Renderable;
    parent: Element;
  };
  [MarkupType.Repeat]: {
    items: Signal<any[]>;
    key: KeyFn<any>;
    render: RenderFn<any>;
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
export function m<T extends keyof IntrinsicElements>(
  tag: T,
  attrs: IntrinsicElements[T] & { children?: Renderable },
): Markup;

/**
 * Creates a `Markup` element that defines an HTML custom element.
 */
export function m<T extends keyof MarkupCustomElementProps>(type: T, props: MarkupCustomElementProps[T]): Markup;

/**
 * Creates a `Markup` element that defines a `MarkupNode`.
 */
export function m<T extends keyof MarkupNodeProps>(type: T, props: MarkupNodeProps[T]): Markup;

/**
 * Creates a `Markup` element that defines a view.
 */
export function m<P extends {}>(type: View<P>, props?: P): Markup;

/**
 * Creates a `Markup` element that defines a view.
 */
export function m<P>(type: View<P>, props: P): Markup;

export function m(type: string | View<any>, props?: any) {
  return new Markup(type, props ?? {});
}

/*===========================*\
||        View Helpers       ||
\*===========================*/

/**
 * If `condition` is truthy, displays `thenContent`, otherwise `elseContent`.
 */
export function when(condition: MaybeSignal<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  return m(MarkupType.Dynamic, {
    source: $<Renderable>(() => {
      const value = get(condition);

      if (value && thenContent) {
        return thenContent;
      } else if (!value && elseContent) {
        return elseContent;
      }
      return null;
    }),
  });
}

/**
 * Inverted `when`. If `condition` is falsy, displays `thenContent`, otherwise `elseContent`.
 */
export function unless(condition: MaybeSignal<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  return when(condition, elseContent, thenContent);
}

/**
 * Calls `render` for each item in `items`. Dynamically adds and removes views as items change.
 * The result of `key` is used to compare items and decide if item was added, removed or updated.
 */
export function repeat<T>(items: MaybeSignal<T[]>, key: KeyFn<T>, render: RenderFn<T>): Markup {
  return m(MarkupType.Repeat, { items: () => get(items), key, render });
}

/**
 * Renders `content` into a `parent` node anywhere in the page, rather than its usual position in the view.
 */
export function portal(parent: Element, content: Renderable): Markup {
  return m(MarkupType.Portal, { parent, content });
}

/*===========================*\
||           Render          ||
\*===========================*/

/**
 * Takes any `Renderable` value and returns a `MarkupNode` that will display it.
 */
export function render(content: Renderable, context = new Context("$")): MarkupNode {
  const nodes = toMarkupNodes(context, content);
  if (nodes.length === 1) {
    return nodes[0];
  }
  return new DynamicNode(context, () => nodes);
}

/**
 * Convert basically anything into a set of `MarkupNode`s.
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

    if (item instanceof Markup) {
      if (isFunction(item.type)) {
        nodes.push(new ViewNode(context, item.type as View<any>, item.props));
        continue;
      } else if (isString(item.type)) {
        switch (item.type) {
          case MarkupType.DOM: {
            const attrs = item.props! as MarkupNodeProps[MarkupType.DOM];
            nodes.push(new DOMNode(attrs.value));
            continue;
          }
          case MarkupType.Dynamic: {
            const attrs = item.props! as MarkupNodeProps[MarkupType.Dynamic];
            nodes.push(new DynamicNode(context, attrs.source));
            continue;
          }
          case MarkupType.Portal: {
            const attrs = item.props! as MarkupNodeProps[MarkupType.Portal];
            nodes.push(new PortalNode(context, attrs.content, attrs.parent));
            continue;
          }
          case MarkupType.Repeat: {
            const attrs = item.props! as MarkupNodeProps[MarkupType.Repeat];
            nodes.push(new RepeatNode(context, attrs.items, attrs.key, attrs.render));
            continue;
          }
          default:
            // Assume `type` is an HTML/SVG tag.
            nodes.push(new ElementNode(context, item.type, item.props));
            continue;
        }
      } else {
        throw new TypeError(`Expected a string or view function. Got: ${item.type}`);
      }
    }

    if (item instanceof MarkupNode) {
      nodes.push(item);
      continue;
    }

    if (isFunction(item)) {
      nodes.push(new DynamicNode(context, item));
      continue;
    }

    // fallback to displaying value as text
    nodes.push(new DOMNode(document.createTextNode(String(item))));
  }

  return nodes;
}
