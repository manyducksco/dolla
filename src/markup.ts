import { isArray, isArrayOf, isFunction, isNumber, isObject, isString } from "@borf/bedrock";
import { type AppContext, type ElementContext } from "./app.js";
import { Conditional } from "./nodes/cond.js";
import { HTML } from "./nodes/html.js";
import { Observer } from "./nodes/observer.js";
import { Outlet } from "./nodes/outlet.js";
import { Portal } from "./nodes/portal.js";
import { Repeat } from "./nodes/repeat.js";
import { Text } from "./nodes/text.js";
import { isReadable, readable, type Readable } from "./state.js";
import type { Renderable, Stringable } from "./types.js";
import { initView, type View, type ViewContext, type ViewResult } from "./view.js";

/*===========================*\
||           Markup          ||
\*===========================*/

const MARKUP = Symbol("Markup");

/**
 * Markup is a set of element metadata that hasn't been rendered to a DOMHandle yet.
 */
export interface Markup {
  type: string | View<any>;
  props?: Record<string, any>;
  children?: Markup[];
}

/**
 * DOMHandle is the generic interface for an element that can be manipulated by the framework.
 */
export interface DOMHandle {
  readonly node?: Node;
  readonly connected: boolean;

  connect(parent: Node, after?: Node): void;

  disconnect(): void;

  setChildren(children: DOMHandle[]): void;
}

export function isMarkup(value: unknown): value is Markup {
  return isObject(value) && value[MARKUP] === true;
}

export function isDOMHandle(value: unknown): value is DOMHandle {
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
        return m("$node", { value: x });
      }

      if (isMarkup(x)) {
        return x;
      }

      if (isString(x) || isNumber(x)) {
        return m("$text", { value: x });
      }

      if (isReadable(x)) {
        return m("$observer", {
          readables: [x],
          renderFn: (x) => x,
        });
      }

      console.error(x);
      throw new TypeError(`Unexpected child type. Got: ${x}`);
    });
}

export interface MarkupAttributes {
  $text: { value: Stringable | Readable<Stringable> };
  $cond: { $predicate: Readable<any>; thenContent?: Renderable; elseContent?: Renderable };
  $repeat: {
    $items: Readable<any[]>;
    keyFn: (value: any, index: number) => string | number | symbol;
    renderFn: ($item: Readable<any>, $index: Readable<number>, c: ViewContext) => ViewResult;
  };
  $observer: {
    readables: Readable<any>[];
    renderFn: (...items: any) => Renderable;
  };
  $outlet: {
    $children: Readable<DOMHandle[]>;
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

export function m<T extends keyof MarkupAttributes>(
  type: T,
  attributes: MarkupAttributes[T],
  ...children: Renderable[]
): Markup;

export function m<I>(type: View<I>, attributes?: I, ...children: Renderable[]): Markup;

export function m<P>(type: string | View<P>, props?: P, ...children: Renderable[]) {
  return {
    [MARKUP]: true,
    type,
    props,
    children: toMarkup(children),
  };
}

/*===========================*\
||        Markup Utils       ||
\*===========================*/

/**
 * Displays content conditionally. When `predicate` holds a truthy value, `thenContent` is displayed; when `predicate` holds a falsy value, `elseContent` is displayed.
 */
export function cond(predicate: any | Readable<any>, thenContent?: Renderable, elseContent?: Renderable): Markup {
  const $predicate = readable(predicate);

  return m("$cond", {
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
  items: Readable<T[]> | T[],
  keyFn: (value: T, index: number) => string | number | symbol,
  renderFn: ($value: Readable<T>, $index: Readable<number>, ctx: ViewContext) => ViewResult
): Markup {
  const $items = readable(items);

  return m("$repeat", { $items, keyFn, renderFn });
}

/**
 * Render `content` into a `parent` node anywhere in the page, rather than at its position in the view.
 */
export function portal(content: Renderable, parent: Node) {
  return m("$portal", { content, parent });
}

/*===========================*\
||           Render          ||
\*===========================*/

interface RenderContext {
  appContext: AppContext;
  elementContext: ElementContext;
}

/**
 * Wraps any plain DOM node in a DOMHandle interface.
 */
class NodeHandle implements DOMHandle {
  node: Node;

  get connected() {
    return this.node.parentNode != null;
  }

  constructor(node: Node) {
    this.node = node;
  }

  async connect(parent: Node, after?: Node) {
    parent.insertBefore(this.node, after?.nextSibling ?? null);
  }

  async disconnect() {
    if (this.node.parentNode) {
      this.node.parentNode.removeChild(this.node);
    }
  }

  async setChildren(children: DOMHandle[]) {}
}

export function renderMarkupToDOM(markup: Markup | Markup[], ctx: RenderContext): DOMHandle[] {
  const items = isArray(markup) ? markup : [markup];

  return items.map((item) => {
    if (isFunction(item.type)) {
      return initView({
        view: item.type as View<any>,
        props: item.props,
        children: item.children,
        appContext: ctx.appContext,
        elementContext: ctx.elementContext,
      });
    } else if (isString(item.type)) {
      switch (item.type) {
        case "$node": {
          const attrs = item.props! as MarkupAttributes["$node"];
          return new NodeHandle(attrs.value);
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
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
        }
        case "$repeat": {
          const attrs = item.props! as MarkupAttributes["$repeat"];
          return new Repeat({
            $items: attrs.$items,
            keyFn: attrs.keyFn,
            renderFn: attrs.renderFn,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
        }
        case "$observer": {
          const attrs = item.props! as MarkupAttributes["$observer"];
          return new Observer({
            readables: attrs.readables,
            renderFn: attrs.renderFn,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
        }
        case "$outlet": {
          const attrs = item.props! as MarkupAttributes["$outlet"];
          return new Outlet({
            $children: attrs.$children,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
        }
        case "$portal": {
          const attrs = item.props! as MarkupAttributes["$portal"];
          return new Portal({
            content: attrs.content,
            parent: attrs.parent,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
        }
        default:
          if (item.type.startsWith("$")) {
            throw new Error(`Unknown markup type: ${item.type}`);
          }
          return new HTML({
            tag: item.type,
            props: item.props,
            children: item.children,
            appContext: ctx.appContext,
            elementContext: ctx.elementContext,
          });
      }
    } else {
      throw new TypeError(`Expected a string or view function. Got: ${item.type}`);
    }
  });
}

/**
 * Combines one or more DOMHandles into a single DOMHandle.
 */
export function getRenderHandle(handles: DOMHandle[]): DOMHandle {
  if (handles.length === 1) {
    return handles[0];
  }

  const node = document.createComment("renderHandle");

  let isConnected = false;

  return {
    get node() {
      return node;
    },
    get connected() {
      return isConnected;
    },
    async connect(parent: Node, after?: Node) {
      parent.insertBefore(node, after ? after : null);

      for (const handle of handles) {
        const previous = handles[handles.length - 1]?.node ?? node;
        await handle.connect(parent, previous);
      }

      isConnected = true;
    },
    async disconnect() {
      if (isConnected) {
        for (const handle of handles) {
          handle.disconnect();
        }

        node.remove();
      }

      isConnected = false;
    },
    async setChildren() {},
  };
}

export function isRenderable(value: unknown): value is Renderable {
  return (
    value == null ||
    value === false ||
    typeof value === "string" ||
    typeof value === "number" ||
    isMarkup(value) ||
    isReadable(value) ||
    isArrayOf(isRenderable, value)
  );
}
