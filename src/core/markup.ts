import { isArray, isArrayOf, isFunction, isNumber, isString } from "../typeChecking.js";
import type { Mountable, Renderable } from "../types.js";
import { Context } from "./context.js";
import { DOMNode } from "./nodes/dom.js";
import { Dynamic } from "./nodes/dynamic.js";
import { Fragment } from "./nodes/fragment.js";
import { HTML } from "./nodes/html.js";
import { Outlet } from "./nodes/outlet.js";
import { Portal } from "./nodes/portal.js";
import { Repeat } from "./nodes/repeat.js";
import { ViewInstance, type View, type ViewResult } from "./nodes/view.js";
import { $, get, type MaybeSignal, type Signal } from "./signals.js";
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
  type: string | View<any>;
  /**
   * Data that will be passed to a new MarkupElement instance when it is constructed.
   */
  props?: Record<string, any>;
  /**
   *
   */
  children?: any[];
}

/**
 * A DOM node that has been constructed from a Markup object.
 */
export interface MarkupElement extends Mountable {
  readonly domNode?: Node;

  readonly isMounted: boolean;
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

  const results: Markup[] = [];

  for (const x of renderables) {
    if (x === null || x === undefined || x === false) {
      continue;
    }

    if (x instanceof Node) {
      results.push(m("$node", { value: x }));
      continue;
    }

    if (isMarkup(x)) {
      results.push(x);
      continue;
    }

    if (isFunction(x)) {
      results.push(m("$dynamic", { source: x }));
      continue;
    }

    if (isArray(x)) {
      results.push(...toMarkup(x));
      continue;
    }

    // fallback to displaying value as text
    results.push(m("$text", { value: x }));
  }

  return results;
}

export enum MarkupType {
  Text = "$text",
  Repeat = "$repeat",
  Dynamic = "$dynamic",
  Outlet = "$outlet",
  Fragment = "$fragment",
  Node = "$node",
  Portal = "$portal",
}

export interface MarkupAttributes {
  [MarkupType.Text]: { value: any };
  [MarkupType.Repeat]: {
    items: Signal<any[]>;
    keyFn: (value: any, index: number) => string | number | symbol;
    renderFn: (item: Signal<any>, index: Signal<number>, ctx: Context) => ViewResult;
  };
  [MarkupType.Dynamic]: {
    source: Signal<Renderable>;
  };
  [MarkupType.Outlet]: {
    view: Signal<ViewInstance<{}> | undefined>;
  };
  [MarkupType.Fragment]: {
    children: MaybeSignal<MarkupElement[]>;
  };
  [MarkupType.Node]: {
    value: Node;
  };
  [MarkupType.Portal]: {
    content: Renderable;
    parent: Node;
  };

  [tag: string]: Record<string, any>;
}

export function m<T extends keyof MarkupAttributes>(
  type: T,
  attributes: MarkupAttributes[T],
  ...children: Renderable[]
): Markup;

export function m<I>(type: View<I>, attributes?: I, ...children: any[]): Markup;

export function m<P>(type: string | View<P>, props?: P, ...children: any[]) {
  return new VNode(type, props as any, ...children);
}

class VNode<P extends Record<any, any>> implements Markup {
  type;
  props;
  children;

  constructor(type: string | View<P>, props?: P, ...children: Renderable[]) {
    this.type = type;
    this.props = props;
    this.children = children;
  }
}

/*===========================*\
||        View Helpers       ||
\*===========================*/

/**
 * Displays `thenContent` when `condition` is truthy and `elseContent` when falsy.
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
 * Inverted `when`. Displays `thenContent` when `condition` is falsy and `elseContent` when truthy.
 */
export function unless(condition: MaybeSignal<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  return when(condition, elseContent, thenContent);
}

/**
 * Calls `renderFn` for each item in `items`. Dynamically adds and removes views as items change.
 * The result of `keyFn` is used to compare items and decide if item was added, removed or updated.
 */
export function repeat<T>(
  items: MaybeSignal<T[]>,
  keyFn: (value: T, index: number) => string | number | symbol,
  renderFn: (item: Signal<T>, index: Signal<number>, ctx: Context) => ViewResult,
): Markup {
  return m(MarkupType.Repeat, { items: () => get(items), keyFn, renderFn });
}

/**
 * Renders `content` into a `parent` node anywhere in the page, rather than its usual position in the view.
 */
export function portal(parent: Node, content: Renderable): Markup {
  return m(MarkupType.Portal, { parent, content });
}

/*===========================*\
||           Render          ||
\*===========================*/

export function render(content: Renderable, context = new Context("$")): MarkupElement {
  return groupElements(toMarkupElements(context, toMarkup(content)));
}

/**
 * Construct Markup metadata into a set of MarkupElements.
 */
export function toMarkupElements(context: Context, markup: Markup | Markup[]): MarkupElement[] {
  const items = isArray(markup) ? markup : [markup];

  return items.map((item) => {
    if (isFunction(item.type)) {
      return new ViewInstance(context, item.type as View<any>, item.props, item.children);
    } else if (isString(item.type)) {
      switch (item.type) {
        case MarkupType.Node: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Node];
          return new DOMNode(attrs.value);
        }
        case MarkupType.Text: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Text];
          return new DOMNode(document.createTextNode(String(attrs.value)));
        }
        case MarkupType.Repeat: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Repeat];
          return new Repeat({
            items: attrs.items,
            keyFn: attrs.keyFn,
            renderFn: attrs.renderFn,
            context,
          });
        }
        case MarkupType.Dynamic: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Dynamic];
          return new Dynamic({
            source: attrs.source,
            context,
          });
        }
        case MarkupType.Fragment: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Fragment];
          return new Fragment(attrs.children);
        }
        case MarkupType.Outlet: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Outlet];
          return new Outlet(attrs.view);
        }
        case MarkupType.Portal: {
          const attrs = item.props! as MarkupAttributes[MarkupType.Portal];
          return new Portal({
            content: attrs.content,
            parent: attrs.parent,
            context,
          });
        }
        default:
          // Handle type as an HTML tag.
          return new HTML({
            tag: item.type,
            props: item.props ?? {},
            children: item.children,
            context,
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

  return new Fragment(elements);
}

export function isRenderable(value: unknown): value is Renderable {
  return (
    value == null ||
    value === false ||
    isFunction(value.toString) ||
    isFunction(value) ||
    isString(value) ||
    isNumber(value) ||
    isMarkup(value) ||
    isArrayOf(isRenderable, value)
  );
}
