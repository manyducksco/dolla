import type { MarkupElement } from "../markup";
import { IS_MARKUP_ELEMENT } from "../symbols";

/**
 * Wraps any plain DOM node in a MarkupElement interface.
 */
export class DOMNode implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode: Node;

  get isMounted() {
    return this.domNode.parentNode != null;
  }

  constructor(node: Node) {
    this.domNode = node;
  }

  mount(parent: Node, after?: Node) {
    parent.insertBefore(this.domNode, after?.nextSibling ?? null);
  }

  unmount(parentIsUnmounting = false) {
    if (this.domNode.parentNode && !parentIsUnmounting) {
      this.domNode.parentNode.removeChild(this.domNode);
    }
  }
}
