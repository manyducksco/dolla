import type { MarkupNode } from "../markup";
import { IS_MARKUP_NODE } from "../symbols";

/**
 * Wraps any plain DOM node in a MarkupNode interface.
 */
export class DOMNode implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  root: Node;

  get isMounted() {
    return this.root.parentNode != null;
  }

  constructor(node: Node) {
    this.root = node;
  }

  mount(parent: Node, after?: Node) {
    parent.insertBefore(this.root, after?.nextSibling ?? null);
  }

  unmount(parentIsUnmounting = false) {
    if (this.root.parentNode && !parentIsUnmounting) {
      this.root.parentNode.removeChild(this.root);
    }
  }
}
