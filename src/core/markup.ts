import htm from "htm/mini";

import { isArray, isArrayOf, isFunction, isNumber, isString } from "../typeChecking.js";
import type { Renderable } from "../types.js";
import type { ElementContext } from "./context.js";
import { DOMNode } from "./nodes/dom.js";
import { Dynamic } from "./nodes/dynamic.js";
import { HTML } from "./nodes/html.js";
import { List } from "./nodes/list.js";
import { Outlet } from "./nodes/outlet.js";
import { Portal } from "./nodes/portal.js";
import { View, type ViewContext, type ViewFunction, type ViewResult } from "./nodes/view.js";
import { compose, get, isReactive, MaybeReactive, type Reactive } from "./signals.js";
import { IS_MARKUP_ELEMENT } from "./symbols.js";

/*===========================*\
||           Markup          ||
\*===========================*/

/**
 * Markup is a set of element metadata that hasn't been constructed into a MarkupElement yet.
 */
export interface Markup {
  /**
   * In the case of a view, type will be the View function itself. It can also hold an identifier for special nodes like "$cond", "$repeat", etc.
   * DOM nodes can be created by name, such as HTML elements like "div", "ul" or "span", SVG elements like ""
   */
  type: string | ViewFunction<any>;
  /**
   * Data that will be passed to a new MarkupElement instance when it is constructed.
   */
  props?: Record<string, any>;
  /**
   *
   */
  children?: Markup[];
}

/**
 * A DOM node that has been constructed from a Markup object.
 */
export interface MarkupElement {
  readonly node?: Node;

  readonly isMounted: boolean;

  mount(parent: Node, after?: Node): void;

  /**
   * Disconnect from the DOM and clean up. If parentIsUnmounting, DOM operations are skipped.
   * parentIsUnmounting is set for all children by HTML nodes when they unmount.
   */
  unmount(parentIsUnmounting?: boolean): void;
}

export function isMarkup(value: any): value is Markup {
  return value instanceof VNode;
}

export function isMarkupElement(value: any): value is MarkupElement {
  return value?.[IS_MARKUP_ELEMENT] === true;
}

export function toMarkup(renderables: Renderable | Renderable[]): Markup[] {
  if (!isArray(renderables)) {
    renderables = [renderables];
  }

  return renderables
    .flat(Infinity)
    .filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => {
      if (isMarkup(x)) {
        return x;
      }

      if (x instanceof Node) {
        return createMarkup("$node", { value: x });
      }

      if (isReactive<Renderable>(x)) {
        return createMarkup("$dynamic", { source: x });
      }

      // fallback to displaying value as text
      return createMarkup("$text", { value: x });
    });
}

export interface MarkupAttributes {
  $text: { value: any };
  $list: {
    items: Reactive<any[]>;
    keyFn: (value: any, index: number) => string | number | symbol;
    renderFn: (item: Reactive<any>, index: Reactive<number>, ctx: ViewContext) => ViewResult;
  };
  $dynamic: {
    source: Reactive<Renderable>;
  };
  $outlet: {
    children: MaybeReactive<MarkupElement[]>;
  };
  $node: {
    value: Node;
  };
  $portal: {
    content: Renderable;
    parent: Node;
  };

  [tag: string]: Record<string, any>;
}

export function createMarkup<T extends keyof MarkupAttributes>(
  type: T,
  attributes: MarkupAttributes[T],
  ...children: Renderable[]
): Markup;

export function createMarkup<I>(type: ViewFunction<I>, attributes?: I, ...children: Renderable[]): Markup;

export function createMarkup<P>(type: string | ViewFunction<P>, props?: P, ...children: Renderable[]) {
  return new VNode(type, props as any, ...children);
}

class VNode<P extends Record<any, any>> implements Markup {
  type;
  props;
  children;

  constructor(type: string | ViewFunction<P>, props?: P, ...children: Renderable[]) {
    this.type = type;
    this.props = props;
    this.children = toMarkup(children);
  }
}

/*===========================*\
||        View Helpers       ||
\*===========================*/

/**
 * Generate markup with HTML in a tagged template literal.
 */
export const html = htm.bind(createMarkup);

/**
 * Displays content conditionally. When `condition` holds a truthy value, `thenContent` is displayed; when `condition` holds a falsy value, `elseContent` is displayed.
 */
export function cond(condition: MaybeReactive<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  return createMarkup("$dynamic", {
    source: compose<Renderable>(() => {
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
 * Calls `renderFn` for each item in `items`. Dynamically adds and removes views as items change.
 * The result of `keyFn` is used to compare items and decide if item was added, removed or updated.
 */
export function list<T>(
  items: MaybeReactive<T[]>,
  keyFn: (value: T, index: number) => string | number | symbol,
  renderFn: (item: Reactive<T>, index: Reactive<number>, ctx: ViewContext) => ViewResult,
): Markup {
  return createMarkup("$list", { items: compose(() => items), keyFn, renderFn });
}

/**
 * Renders `content` into a `parent` node anywhere in the page, rather than its usual position in the view.
 */
export function portal(parent: Node, content: Renderable): Markup {
  return createMarkup("$portal", { parent, content });
}

/*===========================*\
||           Render          ||
\*===========================*/

/**
 * Construct Markup metadata into a set of MarkupElements.
 */
export function constructMarkup(elementContext: ElementContext, markup: Markup | Markup[]): MarkupElement[] {
  const items = isArray(markup) ? markup : [markup];

  return items.map((item) => {
    if (isFunction(item.type)) {
      return new View(elementContext, item.type as ViewFunction<any>, item.props, item.children);
    } else if (isString(item.type)) {
      switch (item.type) {
        case "$node": {
          const attrs = item.props! as MarkupAttributes["$node"];
          return new DOMNode(attrs.value);
        }
        case "$text": {
          const attrs = item.props! as MarkupAttributes["$text"];
          return new DOMNode(document.createTextNode(String(attrs.value)));
        }
        case "$list": {
          const attrs = item.props! as MarkupAttributes["$list"];
          return new List({
            items: attrs.items,
            keyFn: attrs.keyFn,
            renderFn: attrs.renderFn,
            elementContext,
          });
        }
        case "$dynamic": {
          const attrs = item.props! as MarkupAttributes["$dynamic"];
          return new Dynamic({
            source: attrs.source,
            elementContext,
          });
        }
        case "$outlet": {
          const attrs = item.props! as MarkupAttributes["$outlet"];
          return new Outlet(attrs.children);
        }
        case "$portal": {
          const attrs = item.props! as MarkupAttributes["$portal"];
          return new Portal({
            content: attrs.content,
            parent: attrs.parent,
            elementContext,
          });
        }
        default:
          if (item.type.startsWith("$")) {
            throw new Error(`Unknown markup type: ${item.type}`);
          }
          return new HTML({
            tag: item.type,
            props: item.props ?? {},
            children: item.children,
            elementContext,
          });
      }
    } else {
      throw new TypeError(`Expected a string or view function. Got: ${item.type}`);
    }
  });
}

/**
 * Combines one or more MarkupElements into a single MarkupElement.
 */
export function groupElements(elements: MarkupElement[]): MarkupElement {
  if (elements.length === 1) {
    return elements[0];
  }

  return new Outlet(elements);
}

export function isRenderable(value: unknown): value is Renderable {
  return (
    value == null ||
    value === false ||
    isString(value) ||
    isNumber(value) ||
    isMarkup(value) ||
    isReactive(value) ||
    isArrayOf(isRenderable, value)
  );
}
