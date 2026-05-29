import type { View } from "../../../types.js";
import { Context, createContext, mountContext, cleanupContext } from "../../context.js";
import { peek } from "../../signals.js";
import { MarkupNode } from "../types.js";
import { createTextNode, render } from "../utils.js";
import { DOMNode } from "./dom.js";
import { registerViewInstance, unregisterViewInstance } from "../../hmr.js";

export const VIEW = Symbol.for("$_VIEW_NODE");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly #props: P;
  #view: View<P>;
  #node?: MarkupNode;

  readonly context: Context;

  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = createContext(context, {
      [VIEW]: this,
      name: view.name,
    });
    this.#props = props;
    this.#view = view;
  }

  getRoot() {
    return this.#node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted;
  }

  mount(parent: Element, after?: Node) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      const viewContent = peek(() => this.#view.call(this.context, this.#props, this.context));

      if (viewContent != null && viewContent !== false) {
        this.#node = render(viewContent, this.context);
      } else {
        this.#node = new DOMNode(this.context, createTextNode(""));
      }

      registerViewInstance(this.#view, this);
    }

    this.#node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  unmount(skipDOM = false) {
    this.#node?.unmount(skipDOM);
    cleanupContext(this.context);
    unregisterViewInstance(this.#view, this);
  }

  move(parent: Element, after?: Node) {
    this.#node?.move(parent, after);
  }

  replaceView(newView: View<P>) {
    const wasMounted = this.isMounted();
    if (!wasMounted) {
      unregisterViewInstance(this.#view, this);
      this.#view = newView;
      this.context.name = newView.name;
      registerViewInstance(this.#view, this);
      return;
    }

    const oldRoot = this.#node?.getRoot();
    const parent = oldRoot?.parentElement;
    const after = oldRoot?.previousSibling ?? undefined;

    this.#node?.unmount();
    cleanupContext(this.context);
    unregisterViewInstance(this.#view, this);

    this.#view = newView;
    this.context.name = newView.name;

    const viewContent = peek(() => this.#view.call(this.context, this.#props, this.context));
    this.#node =
      viewContent != null && viewContent !== false
        ? render(viewContent, this.context)
        : new DOMNode(this.context, createTextNode(""));

    registerViewInstance(this.#view, this);

    if (parent) {
      this.#node.mount(parent, after);
    }

    mountContext(this.context);
  }
}
