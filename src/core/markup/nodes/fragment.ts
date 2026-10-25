import type { Context } from "../../context.js";
import { runSafely } from "../../errors.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter } from "../utils.js";

/**
 * A lightweight MarkupNode that holds multiple child nodes without any
 * reactive subscription.  Used by `render()` when a View returns more than
 * one root node.
 */
export class FragmentNode extends MarkupNode {
  #anchor: Text | null = null;
  #children: MarkupNode[];
  #context: Context;

  constructor(context: Context, children: MarkupNode[]) {
    super();
    this.#context = context;
    this.#children = children;
  }

  override getRoot() {
    return this.#anchor ?? undefined;
  }

  override isMounted() {
    return this.#anchor?.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node | null) {
    if (this.isMounted()) return;

    this.#anchor = createTextNode("");
    addChild(parent, this.#anchor, after);

    let ref: Node = this.#anchor;
    for (const child of this.#children) {
      child.mount(parent, ref);
      const root = child.getRoot();
      if (root) ref = root;
    }
  }

  override unmount(skipDOM = false) {
    if (!this.isMounted()) return;

    if (!skipDOM) {
      this.#anchor!.parentNode?.removeChild(this.#anchor!);
    }

    for (const child of this.#children) {
      runSafely(() => child.unmount(skipDOM), { phase: "unmount", context: this.#context });
    }
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;

    moveAfter(parent, this.#anchor, after);

    let ref: Node = this.#anchor;
    for (const child of this.#children) {
      child.move(parent, ref);
      const root = child.getRoot();
      if (root) ref = root;
    }
  }
}
