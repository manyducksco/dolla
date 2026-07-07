import { Context } from "../../context.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, moveAfter } from "../utils.js";

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

  override mount(parent: MountTarget, after?: Node | null) {
    addChild(parent, this.#root, after);
  }

  override unmount(skipDOM = false) {
    if (skipDOM) return;
    this.#root.parentNode?.removeChild(this.#root);
  }

  override move(parent: Element, after?: Node | null) {
    moveAfter(parent, this.#root, after);
  }
}
