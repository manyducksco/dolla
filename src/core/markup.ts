import htm from "htm/mini";

import { isArray, isArrayOf, isFunction, isNumber, isString } from "../typeChecking.js";
import type { Renderable, Stringable } from "../types.js";
import type { Dolla } from "./dolla.js";
import { HTML } from "./nodes/html.js";
import { Observer } from "./nodes/observer.js";
import { Outlet } from "./nodes/outlet.js";
import { Portal } from "./nodes/portal.js";
import { Repeat } from "./nodes/repeat.js";
import { Text } from "./nodes/text.js";
import { View, type ViewContext, type ViewFunction, type ViewResult } from "./nodes/view.js";
import { MaybeState, isState, toState, type State } from "./state.js";
import { TYPE_MARKUP, TYPE_MARKUP_ELEMENT } from "./symbols.js";

/*===========================*\
||       ElementContext      ||
\*===========================*/

export interface ElementContext {
  /**
   * The root Dolla instance this element belongs to.
   */
  root: Dolla;
  /**
   * Storage for context variables.
   */
  data: Record<string | symbol, unknown>;
  /**
   * A reference to the parent context.
   */
  parent?: ElementContext;
  /**
   * Whether to create DOM nodes in the SVG namespace. An `<svg>` element will set this to true and pass it down to children.
   */
  isSVG?: boolean;
}

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
   */
  unmount(parentIsUnmounting?: boolean): void;
}

export function isMarkup(value: any): value is Markup {
  return value?.[TYPE_MARKUP] === true;
}

export function isMarkupElement(value: any): value is MarkupElement {
  return value?.[TYPE_MARKUP_ELEMENT] === true;
}

export function toMarkup(renderables: Renderable | Renderable[]): Markup[] {
  if (!isArray(renderables)) {
    renderables = [renderables];
  }

  return renderables
    .flat(Infinity)
    .filter((x) => x !== null && x !== undefined && x !== false)
    .map((x) => {
      if (x instanceof Node) {
        return createMarkup("$node", { value: x });
      }

      if (x instanceof DOMNode) {
        return createMarkup("$node", { value: x.node });
      }

      if (isMarkup(x)) {
        return x;
      }

      if (isString(x) || isNumber(x)) {
        return createMarkup("$text", { value: x });
      }

      if (isState(x)) {
        return createMarkup("$observer", {
          sources: [x],
          renderFn: (x) => x,
        });
      }

      console.error(x);
      throw new TypeError(`Unexpected child type. Got: ${x}`);
    });
}

export interface MarkupAttributes {
  $text: { value: MaybeState<Stringable> };
  $repeat: {
    $items: State<any[]>;
    keyFn: (value: any, index: number) => string | number | symbol;
    renderFn: ($item: State<any>, $index: State<number>, c: ViewContext) => ViewResult;
  };
  $observer: {
    sources: MaybeState<any>[];
    renderFn: (...items: any) => Renderable;
  };
  $outlet: {
    $children: State<MarkupElement[]>;
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
  // TODO: Alternate path here for SSR?

  return {
    [TYPE_MARKUP]: true,
    type,
    props,
    children: toMarkup(children),
  };
}

/*===========================*\
||        View Helpers       ||
\*===========================*/

/**
 * Generate markup with HTML in a tagged template literal.
 */
export const html = htm.bind(createMarkup);

/**
 * Displays content conditionally. When `predicate` holds a truthy value, `thenContent` is displayed; when `predicate` holds a falsy value, `elseContent` is displayed.
 */
export function cond(predicate: MaybeState<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  return createMarkup("$observer", {
    sources: [predicate],
    renderFn: (value) => {
      if (value && thenContent) {
        return thenContent;
      } else if (!value && elseContent) {
        return elseContent;
      }
      return null;
    },
  });
}

/**
 * Calls `renderFn` for each item in `items`. Dynamically adds and removes views as items change.
 * The result of `keyFn` is used to compare items and decide if item was added, removed or updated.
 */
export function repeat<T>(
  items: MaybeState<T[]>,
  keyFn: (value: T, index: number) => string | number | symbol,
  renderFn: ($value: State<T>, $index: State<number>, ctx: ViewContext) => ViewResult,
): Markup {
  const $items = toState(items);

  return createMarkup("$repeat", { $items, keyFn, renderFn });
}

/**
 * Render `content` into a `parent` node anywhere in the page, rather than at its position in the view.
 */
export function portal(parent: Node, content: Renderable) {
  return createMarkup("$portal", { parent, content });
}

/*===========================*\
||           Render          ||
\*===========================*/

/**
 * Wraps any plain DOM node in a MarkupElement interface.
 */
class DOMNode implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node: Node;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor(node: Node) {
    this.node = node;
  }

  async mount(parent: Node, after?: Node) {
    parent.insertBefore(this.node, after?.nextSibling ?? null);
  }

  async unmount() {
    if (this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  }
}

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
          return new Text({
            value: attrs.value,
          });
        }
        // case "$cond": {
        //   const attrs = item.props! as MarkupAttributes["$cond"];
        //   return new Conditional({
        //     $predicate: attrs.$predicate,
        //     thenContent: attrs.thenContent,
        //     elseContent: attrs.elseContent,
        //     elementContext,
        //   });
        // }
        case "$repeat": {
          const attrs = item.props! as MarkupAttributes["$repeat"];
          return new Repeat({
            $items: attrs.$items,
            keyFn: attrs.keyFn,
            renderFn: attrs.renderFn,
            elementContext,
          });
        }
        case "$observer": {
          const attrs = item.props! as MarkupAttributes["$observer"];
          return new Observer({
            sources: attrs.sources,
            renderFn: attrs.renderFn,
            elementContext,
          });
        }
        case "$outlet": {
          const attrs = item.props! as MarkupAttributes["$outlet"];
          return new Outlet(attrs.$children);
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
    isState(value) ||
    isArrayOf(isRenderable, value)
  );
}
