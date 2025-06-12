import type { MarkupNode } from "../markup";
import { MARKUP_NODE, TYPE } from "../symbols";

/**
 * Lightweight MarkupNode wrapper for a plain DOM node.
 */
export class DOMNode implements MarkupNode {
  [TYPE] = MARKUP_NODE;

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

  unmount(skipDOM = false) {
    if (!skipDOM && this.root.parentNode) {
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
