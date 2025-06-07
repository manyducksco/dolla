import { isFunction } from "../../typeChecking.js";
import type { View } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import { Context, LifecycleEvent } from "../context.js";
import { render, type MarkupNode } from "../markup.js";
import { IS_MARKUP_NODE } from "../symbols.js";
import { DOMNode } from "./dom.js";
import { Dynamic } from "./dynamic.js";

export const VIEW = Symbol("View");

export class ViewInstance<P> implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  uniqueId = getUniqueId();
  context: Context;
  props;
  fn;

  node?: MarkupNode;

  constructor(context: Context, fn: View<P>, props: P, children?: any[]) {
    this.context = Context.linked(context, fn.name ?? "anonymous view", {
      logger: {
        tag: this.uniqueId,
        tagName: "uid",
      },
    });
    this.context.setState(VIEW, this);
    this.props = { ...props, children };
    this.fn = fn;
  }

  /*===============================*\
  ||         "Public" API          ||
  \*===============================*/

  get root() {
    return this.node?.root!;
  }

  get isMounted() {
    return this.context.isMounted;
  }

  mount(parent: Node, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasConnected = this.isMounted;

    if (!wasConnected) {
      this._initialize();
      Context.emit(LifecycleEvent.WILL_MOUNT, this.context);
    }

    if (this.node) {
      this.node.mount(parent, after);
    }

    if (!wasConnected) {
      // Do it in a rAF so onMounted callbacks can access rendered DOM nodes.
      // requestAnimationFrame(() => {
      Context.emit(LifecycleEvent.DID_MOUNT, this.context);
      // });
    }
  }

  unmount(parentIsUnmounting = false) {
    Context.emit(LifecycleEvent.WILL_UNMOUNT, this.context);

    if (this.node) {
      this.node.unmount(parentIsUnmounting);
    }

    Context.emit(LifecycleEvent.DID_UNMOUNT, this.context);
  }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  private _initialize() {
    const { context, props, fn } = this;

    let result: any;
    try {
      result = fn.call(context, props, context);
    } catch (error) {
      if (error instanceof Error) {
        context.crash(error);
      }
      throw error;
    }

    if (result == null) {
      // Do nothing.
    } else if (result instanceof Node) {
      this.node = new DOMNode(result);
    } else if (isFunction(result)) {
      this.node = new Dynamic(context, result);
    } else {
      this.node = render(result, context);
    }
  }
}
