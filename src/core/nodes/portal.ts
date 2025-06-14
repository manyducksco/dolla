import type { Renderable } from "../../types.js";
import { Context } from "../context.js";
import { render } from "../markup.js";
import { MarkupNode } from "./_markup.js";

/**
 * Renders content into a specified parent node.
 */
export class PortalNode extends MarkupNode {
  private context;
  private value;
  private parent;

  private node?: MarkupNode;

  constructor(context: Context, value: Renderable, parent: Element) {
    super();
    this.context = context;
    this.value = value;
    this.parent = parent;
  }

  override getRoot() {
    return this.node?.getRoot();
  }

  override isMounted() {
    if (!this.node) {
      return false;
    }
    return this.node.isMounted();
  }

  override mount(_parent: Element, _after?: Node) {
    const node = render(this.value, this.context);
    this.node = node;
    node.mount(this.parent);
  }

  override unmount(skipDOM = false) {
    if (this.node?.isMounted()) {
      // Portals must unmount DOM nodes because they won't be removed by parents unmounting.
      this.node.unmount(false);
    }
  }

  override move(_parent: Element, _after?: Node) {
    // Moving does not apply to portals.
  }
}
