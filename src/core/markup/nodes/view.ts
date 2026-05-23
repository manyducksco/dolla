import type { View } from "../../../types.js";
import { Context, createContext, mountContext, cleanupContext } from "../../context.js";
import { peek } from "../../signals.js";
import { MarkupNode } from "../types.js";
import { createTextNode, render } from "../utils.js";
import { DOMNode } from "./dom.js";

export const VIEW = Symbol.for("$_VIEW_NODE");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly #props: P;
  readonly #view: View<P>;
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
    }

    this.#node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  unmount(skipDOM = false) {
    this.#node?.unmount(skipDOM);
    cleanupContext(this.context);
  }

  move(parent: Element, after?: Node) {
    this.#node?.move(parent, after);
  }
}
