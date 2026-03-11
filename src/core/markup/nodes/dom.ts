import { addChild, moveBefore } from "../../../utils.js";
import { Context } from "../../context.js";
import { MarkupNode, MountTarget } from "../types.js";

/**
 * A lightweight MarkupNode wrapper for a plain DOM node.
 */
export class DOMNode extends MarkupNode {
  #root: Node;

  constructor(_context: Context, node: Node) {
    super();
    this.#root = node;
  }

  override getRoot() {
    return this.#root;
  }

  override isMounted() {
    return this.#root.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node) {
    addChild(parent, this.#root, after);
  }

  override unmount(skipDOM = false) {
    if (!skipDOM && this.#root.parentNode != null) {
      this.#root.parentNode.removeChild(this.#root);
    }
  }

  override move(parent: Element, after?: Node) {
    moveBefore(parent, this.#root, after?.nextSibling ?? null);
  }
}
