import type { View } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import { Context, LifecycleEvent } from "../context.js";
import { render } from "../markup.js";
import { MarkupNode } from "./_markup.js";
import { setCurrentContext } from "../signals.js";

export const VIEW = Symbol("ViewNode");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  uniqueId = getUniqueId();
  context: Context;
  props;
  view;

  node?: MarkupNode;

  /**
   * @param context - Parent contenxt to link to.
   * @param view - View function to mount.
   * @param props - Props to pass to view function.
   */
  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = Context.linked(context, view.name ?? "anonymous view", {
      logger: {
        tag: this.uniqueId,
        tagName: "uid",
      },
    });
    this.context.setState(VIEW, this);
    this.props = props;
    this.view = view;
  }

  getRoot() {
    return this.node?.getRoot();
  }

  isMounted() {
    return this.node?.isMounted() ?? false;
  }

  mount(parent: Element, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      const { context, props, view } = this;
      try {
        const prevCtx = setCurrentContext(context);
        const result = view.call(context, props, context);
        setCurrentContext(prevCtx);
        if (result != null && result !== false) {
          this.node = render(result, context);
        }
      } catch (error) {
        if (error instanceof Error) {
          context.crash(error);
        }
        throw error;
      }

      Context.emit(this.context, LifecycleEvent.WILL_MOUNT);
    }

    if (this.node) {
      this.node.mount(parent, after);
    }

    if (!wasMounted) Context.emit(this.context, LifecycleEvent.DID_MOUNT);
  }

  unmount(skipDOM = false) {
    Context.emit(this.context, LifecycleEvent.WILL_UNMOUNT);

    if (this.node) {
      this.node.unmount(skipDOM);
    }

    Context.emit(this.context, LifecycleEvent.DID_UNMOUNT);
    Context.emit(this.context, LifecycleEvent.DISPOSE);
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
