import { isFunction, isString } from "../typeChecking.js";
import type { Renderable, View } from "../types.js";
import { Context } from "./context.js";
import { DOMNode } from "./nodes/dom.js";
import { Dynamic } from "./nodes/dynamic.js";
import { HTML } from "./nodes/html.js";
import { Portal } from "./nodes/portal.js";
import { KeyFn, RenderFn, Repeat } from "./nodes/repeat.js";
import { ViewInstance } from "./nodes/view.js";
import { $, get, type MaybeSignal, type Signal } from "./signals.js";
import { IS_MARKUP_NODE } from "./symbols.js";

/*===========================*\
||           Markup          ||
\*===========================*/

/**
 * Markup is a set of element metadata that hasn't been constructed into a MarkupElement yet.
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
 * A mountable node that has been constructed from Markup metadata.
 */
export interface MarkupNode {
  /**
   *
   */
  readonly root?: Node;

  /**
   *
   */
  isMounted(): boolean;

  /**
   *
   */
  mount(parent: Element, after?: Node): void;

  /**
   *
   */
  unmount(parentIsUnmounting?: boolean): void;

  /**
   * Moves a node without unmounting and remounting (if the browser supports Element.moveBefore).
   */
  move(parent: Element, after?: Node): void;
}

export function isMarkupNode(value: any): value is MarkupNode {
  return value?.[IS_MARKUP_NODE] === true;
}

export enum MarkupType {
  Text = "$text",
  Repeat = "$repeat",
  Dynamic = "$dynamic",
  DOM = "$dom",
  Portal = "$portal",
}

export interface MarkupProps {
  [MarkupType.Text]: { value: any };
  [MarkupType.Repeat]: {
    items: Signal<any[]>;
    key: KeyFn<any>;
    render: RenderFn<any>;
  };
  [MarkupType.Dynamic]: {
    source: Signal<any>;
  };
  [MarkupType.DOM]: {
    value: Node;
  };
  [MarkupType.Portal]: {
    content: Renderable;
    parent: Element;
  };

  [tag: string]: Record<string, any>;
}

export function m<T extends keyof MarkupProps>(type: T, props: MarkupProps[T]): Markup;

export function m<P extends {}>(type: View<P>, props?: P): Markup;
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

export function render(content: Renderable, context = new Context("$")): MarkupNode {
  const nodes = toMarkupNodes(context, [content]);
  if (nodes.length === 1) {
    return nodes[0];
  }
  return new Dynamic(context, () => nodes);
}

/**
 * Convert basically anything into a set of MarkupElements.
 */
export function toMarkupNodes(context: Context, ...content: any[]): MarkupNode[] {
  const items = content.flat(Infinity);
  const elements: MarkupNode[] = [];

  for (const item of items) {
    if (item === null || item === undefined || item === false) {
      continue;
    }

    if (item instanceof Node) {
      elements.push(new DOMNode(item));
      continue;
    }

    if (item instanceof Markup) {
      if (isFunction(item.type)) {
        elements.push(new ViewInstance(context, item.type as View<any>, item.props));
        continue;
      } else if (isString(item.type)) {
        switch (item.type) {
          case MarkupType.DOM: {
            const attrs = item.props! as MarkupProps[MarkupType.DOM];
            elements.push(new DOMNode(attrs.value));
            continue;
          }
          case MarkupType.Text: {
            const attrs = item.props! as MarkupProps[MarkupType.Text];
            elements.push(new DOMNode(document.createTextNode(String(attrs.value))));
            continue;
          }
          case MarkupType.Repeat: {
            const attrs = item.props! as MarkupProps[MarkupType.Repeat];
            elements.push(new Repeat(context, attrs.items, attrs.key, attrs.render));
            continue;
          }
          case MarkupType.Dynamic: {
            const attrs = item.props! as MarkupProps[MarkupType.Dynamic];
            elements.push(new Dynamic(context, attrs.source));
            continue;
          }
          case MarkupType.Portal: {
            const attrs = item.props! as MarkupProps[MarkupType.Portal];
            elements.push(new Portal(context, attrs.content, attrs.parent));
            continue;
          }
          default:
            // Handle type as an HTML tag.
            elements.push(new HTML(context, item.type, item.props));
            continue;
        }
      } else {
        throw new TypeError(`Expected a string or view function. Got: ${item.type}`);
      }
    }

    if (isMarkupNode(item)) {
      elements.push(item);
      continue;
    }

    if (isFunction(item)) {
      elements.push(new Dynamic(context, item));
      continue;
    }

    // fallback to displaying value as text
    elements.push(new DOMNode(document.createTextNode(String(item))));
  }

  return elements;
}
