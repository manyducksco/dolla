import type { MarkupElement } from "../markup";
import { IS_MARKUP_ELEMENT } from "../symbols";

/**
 * Wraps any plain DOM node in a MarkupElement interface.
 */
export class DOMNode implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  node: Node;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor(node: Node) {
    this.node = node;
  }

  mount(parent: Node, after?: Node) {
    parent.insertBefore(this.node, after?.nextSibling ?? null);
  }

  unmount(parentIsUnmounting = false) {
    if (this.node.parentNode && !parentIsUnmounting) {
      this.node.parentNode.removeChild(this.node);
    }
  }
}
