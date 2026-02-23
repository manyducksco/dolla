import { moveBefore } from "../../../utils";
import { MarkupNode } from "../markup";

/**
 * A lightweight MarkupNode wrapper for a plain DOM node.
 */
export class DOMNode extends MarkupNode {
  private root: Node;

  constructor(node: Node) {
    super();
    this.root = node;
  }

  override getRoot() {
    return this.root;
  }

  override isMounted() {
    return this.root.parentNode != null;
  }

  override mount(parent: Element, after?: Node) {
    parent.insertBefore(this.root, after?.nextSibling ?? null);
  }

  override unmount(skipDOM = false) {
    if (!skipDOM && this.root.parentNode != null) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  override move(parent: Element, after?: Node) {
    moveBefore(parent, this.root, after?.nextSibling ?? null);
  }
}
