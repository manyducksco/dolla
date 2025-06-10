import type { MarkupNode } from "../markup";
import { IS_MARKUP_NODE } from "../symbols";

/**
 * Wraps any plain DOM node in a MarkupNode interface.
 */
export class DOMNode implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  root: Node;

  constructor(node: Node) {
    this.root = node;
  }

  isMounted() {
    return this.root.parentNode != null;
  }

  mount(parent: Element, after?: Node) {
    parent.insertBefore(this.root, after?.nextSibling ?? null);
  }

  unmount(parentIsUnmounting = false) {
    if (this.root.parentNode && !parentIsUnmounting) {
      this.root.parentNode.removeChild(this.root);
    }
  }

  move(parent: Element, after?: Node) {
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
