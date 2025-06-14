import { MarkupNode } from "./_markup";

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
    if (!skipDOM && this.root.parentNode) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  override move(parent: Element, after?: Node) {
    if ("moveBefore" in parent && this.root instanceof Element) {
      try {
        (parent as any).moveBefore(this.root, after?.nextSibling ?? null);
      } catch {
        this.mount(parent, after);
      }
    } else {
      this.mount(parent, after);
    }
  }
}
