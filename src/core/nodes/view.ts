import type { View } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import { Context } from "../context.js";
import { render, type MarkupNode } from "../markup.js";
import { IS_MARKUP_NODE } from "../symbols.js";

export const VIEW = Symbol("View");

export class ViewInstance<P> implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  uniqueId = getUniqueId();
  context: Context;
  props;
  view;

  node?: MarkupNode;

  get root() {
    return this.node?.root!;
  }

  constructor(context: Context, view: View<P>, props: P) {
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
        const result = view.call(context, props, context);
        if (result != null && result !== false) {
          this.node = render(result, context);
        }
      } catch (error) {
        if (error instanceof Error) {
          context.crash(error);
        }
        throw error;
      }

      Context.willMount(this.context);
    }

    if (this.node) {
      this.node.mount(parent, after);
    }

    if (!wasMounted) {
      Context.didMount(this.context);
    }
  }

  unmount(parentIsUnmounting = false) {
    Context.willUnmount(this.context);

    if (this.node) {
      this.node.unmount(parentIsUnmounting);
    }

    Context.didUnmount(this.context);
    Context.dispose(this.context);
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
