import htm from "htm/mini";

import type { Dolla } from "./modules/dolla.js";
import { Conditional } from "./nodes/cond.js";
import { HTML } from "./nodes/html.js";
import { Observer } from "./nodes/observer.js";
import { Outlet } from "./nodes/outlet.js";
import { Portal } from "./nodes/portal.js";
import { Repeat } from "./nodes/repeat.js";
import { Text } from "./nodes/text.js";
import { MaybeState, createState, isSettableState, isState, toState, type State } from "./state.js";
import { isArray, isArrayOf, isFunction, isNumber, isObject, isString } from "./typeChecking.js";
import type { Renderable, Stringable } from "./types.js";
import { constructView, type ViewFunction, type ViewContext, type ViewResult } from "./view.js";

/*===========================*\
||       ElementContext      ||
\*===========================*/

export interface ElementContext {
  /**
   * The root Dolla instance this element belongs to.
   */
  root: Dolla;

  /**
   * Whether to create DOM nodes in the SVG namespace. An `<svg>` element will set this to true and pass it down to children.
   */
  isSVG?: boolean;
}

/*===========================*\
||           Markup          ||
\*===========================*/

const MARKUP = Symbol("Markup");

/**
 * Markup is a set of element metadata that hasn't been constructed into a MarkupNode yet.
 */
export interface Markup {
  type: string | ViewFunction<any>;
  props?: Record<string, any>;
  children?: Markup[];
}

/**
 * A DOM node that has been constructed from a Markup object.
 */
export interface MarkupNode {
  readonly node?: Node;

  readonly isMounted: boolean;

  mount(parent: Node, after?: Node): void;

  unmount(): void;
}

export function isMarkup(value: unknown): value is Markup {
  return isObject(value) && value[MARKUP] === true;
}

export function isNode(value: unknown): value is MarkupNode {
  return isObject(value) && isFunction(value.connect) && isFunction(value.disconnect);
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
          states: [x],
          renderFn: (x) => x,
        });
      }

      console.error(x);
      throw new TypeError(`Unexpected child type. Got: ${x}`);
    });
}

export interface MarkupAttributes {
  $text: { value: MaybeState<Stringable> };
  $cond: { $predicate: State<any>; thenContent?: Renderable; elseContent?: Renderable };
  $repeat: {
    $items: State<any[]>;
    keyFn: (value: any, index: number) => string | number | symbol;
    renderFn: ($item: State<any>, $index: State<number>, c: ViewContext) => ViewResult;
  };
  $observer: {
    states: State<any>[];
    renderFn: (...items: any) => Renderable;
  };
  $outlet: {
    $children: State<MarkupNode[]>;
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
  if (props != null) {
    _assertPropTypes(props as Record<string, any>);
  }

  return {
    [MARKUP]: true,
    type,
    props,
    children: toMarkup(children),
  };
}

/**
 * Throws an error if expectations based on naming conventions aren't met.
 */
function _assertPropTypes(props: Record<string, any>) {
  if (props.ref) {
    if (!isRef(props.ref)) {
      console.warn(props.ref);
      throw new TypeError(`Prop 'ref' must be a Ref object. Got: ${props.ref}`);
    }
  }

  for (const key in props) {
    if (key.startsWith("$$") && props[key] !== undefined) {
      if (!isSettableState(props[key])) {
        throw new TypeError(`Prop '${key}' is named as a SettableState but value is not. Got: ${props[key]}`);
      }
    } else if (key.startsWith("$") && props[key] !== undefined) {
      if (!isState(props[key])) {
        throw new TypeError(`Prop '${key}' is named as a State but value is not. Got: ${props[key]}`);
      }
    }
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
 * Displays content conditionally. When `predicate` holds a truthy value, `thenContent` is displayed; when `predicate` holds a falsy value, `elseContent` is displayed.
 */
export function cond(predicate: MaybeState<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  const $predicate = toState(predicate);

  return createMarkup("$cond", {
    $predicate,
    thenContent,
    elseContent,
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
||            Ref            ||
\*===========================*/

/**
 * A special kind of State exclusively for storing references to DOM nodes.
 */
export function createRef<T extends Node>(): Ref<T> {
  const [$node, setNode] = createState<T>();

  return {
    get: $node.get,
    watch: $node.watch,

    get node() {
      return $node.get();
    },
    set node(node) {
      setNode(node);
    },
  };
}

export function isRef<T extends Node>(value: any): value is Ref<T> {
  if (value == null || typeof value !== "object") {
    return false;
  }

  if (!value.hasOwnProperty("node")) {
    return false;
  }

  return true;
}

export interface Ref<T extends Node> extends State<T | undefined> {
  node: T | undefined;
}

/*===========================*\
||           Render          ||
\*===========================*/

/**
 * Wraps any plain DOM node in a MarkupNode interface.
 */
class DOMNode implements MarkupNode {
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
 * Construct Markup metadata into a set of MarkupNodes.
 */
export function constructMarkup(elementContext: ElementContext, markup: Markup | Markup[]): MarkupNode[] {
  const items = isArray(markup) ? markup : [markup];

  return items.map((item) => {
    if (isFunction(item.type)) {
      return constructView(elementContext, item.type as ViewFunction<any>, item.props, item.children);
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
        case "$cond": {
          const attrs = item.props! as MarkupAttributes["$cond"];
          return new Conditional({
            $predicate: attrs.$predicate,
            thenContent: attrs.thenContent,
            elseContent: attrs.elseContent,
            elementContext,
          });
        }
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
            states: attrs.states,
            renderFn: attrs.renderFn,
            elementContext,
          });
        }
        case "$outlet": {
          const attrs = item.props! as MarkupAttributes["$outlet"];
          return new Outlet({
            $children: attrs.$children,
            elementContext,
          });
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
 * Combines one or more MarkupNodes into a single MarkupNode.
 */
export function mergeNodes(nodes: MarkupNode[]): MarkupNode {
  if (nodes.length === 1) {
    return nodes[0];
  }

  const node = document.createComment("Fragment");

  let isConnected = false;

  return {
    get node() {
      return node;
    },
    get isMounted() {
      return isConnected;
    },
    mount(parent: Node, after?: Node) {
      parent.insertBefore(node, after ? after : null);

      for (const handle of nodes) {
        const previous = nodes[nodes.length - 1]?.node ?? node;
        handle.mount(parent, previous);
      }

      isConnected = true;
    },
    unmount() {
      if (isConnected) {
        for (const handle of nodes) {
          handle.unmount();
        }

        node.remove();
      }

      isConnected = false;
    },
  };
}

export function isRenderable(value: unknown): value is Renderable {
  return (
    value == null ||
    value === false ||
    typeof value === "string" ||
    typeof value === "number" ||
    isMarkup(value) ||
    isState(value) ||
    isArrayOf(isRenderable, value)
  );
}
