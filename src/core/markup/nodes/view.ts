import type { View } from "../../../types.js";
import { callInContext, Context, createContext, mountContext, unmountContext } from "../../context.js";
import { untrack } from "../../signals.js";
import { MarkupNode } from "../types.js";
import { render } from "../utils.js";
import { DOMNode } from "./dom.js";

export const VIEW = Symbol.for("Dolla.ViewNode");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly props: P;
  readonly context: Context;
  readonly view: View<P>;

  node?: MarkupNode;

  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = createContext(view.name, context);
    this.context[VIEW] = this;
    this.props = props;
    this.view = view;
  }

  getRoot() {
    return this.node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted;
  }

  mount(parent: Element, after?: Node) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      const viewContent = callInContext(this.context, () => untrack(() => this.view.call(this.context, this.props)));

      if (viewContent != null && viewContent !== false) {
        this.node = render(viewContent, this.context);
      } else {
        this.node = new DOMNode(this.context, document.createComment(`View: ${this.context.name}`));
      }
    }

    this.node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  unmount(skipDOM = false) {
    this.node?.unmount(skipDOM);
    unmountContext(this.context);
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
