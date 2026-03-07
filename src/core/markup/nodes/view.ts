import type { Renderable, View } from "../../../types.js";
import { contextualize, type Context } from "../../context.js";
import { peek } from "../../reactive.js";
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
    this.context = context.createChild(view.name);
    this.context.state[VIEW] = this;
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
      const viewContent = contextualize(this.context, () => peek(() => this.view(this.props)));

      if (viewContent != null && viewContent !== false) {
        this.node = render(viewContent, this.context);
      } else {
        this.node = new DOMNode(document.createComment(`View: ${this.context.getName()}`));
      }
    }

    this.node!.mount(parent, after);

    if (!wasMounted) this.context.mount();
  }

  unmount(skipDOM = false) {
    this.node?.unmount(skipDOM);
    this.context.unmount();
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
