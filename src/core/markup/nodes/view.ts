import type { Renderable, View } from "../../../types.js";
import { runWithContext, type Context } from "../../context.js";
import { MarkupNode } from "../types.js";
import { render } from "../utils.js";
import { DOMNode } from "./dom.js";

export const VIEW = Symbol("ViewNode");
export const VIEW_PRELOAD_CALLBACK = Symbol();
export const VIEW_TRANSITIONS_CONFIG = Symbol();

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly props: P;
  readonly context: Context;
  readonly view: View<P>;

  viewContent?: Renderable;
  node?: MarkupNode;

  initialized = false;

  /**
   * @param context - Parent contenxt to link to.
   * @param view - View function to mount.
   * @param props - Props to pass to view function.
   */
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
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      let viewContent: Renderable;

      runWithContext(this.context, () => {
        viewContent = this.view(this.props);
      });

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
