import type { Context } from "../../context.js";
import { runSafely } from "../../errors.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, lastNodeOf, moveAfter, moveChildrenAfter } from "../utils.js";

/**
 * A lightweight MarkupNode that holds multiple child nodes without any
 * reactive subscription.  Used by `render()` when a View returns more than
 * one root node.
 */
export class FragmentNode extends MarkupNode {
  #anchor: Text | null = null;
  #children: MarkupNode[];
  #context: Context;
  #mounted = false;

  constructor(context: Context, children: MarkupNode[]) {
    super();
    this.#context = context;
    this.#children = children;
  }

  override getRoot() {
    return this.#anchor ?? undefined;
  }

  override getLastNode() {
    return lastNodeOf(this.#children, this.#anchor);
  }

  override isMounted() {
    return this.#anchor?.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node | null) {
    if (this.isMounted()) return;
    this.#mounted = true;

    this.#anchor = createTextNode("");
    addChild(parent, this.#anchor, after);
    moveChildrenAfter(parent, this.#anchor, this.#children, true);
  }

  override unmount(skipDOM = false) {
    // Tracked separately from `isMounted()`, so children are cleaned up even
    // if something else already detached the anchor.
    if (!this.#mounted) return;
    this.#mounted = false;

    if (!skipDOM) this.#anchor!.parentNode?.removeChild(this.#anchor!);

    for (const child of this.#children) {
      runSafely(() => child.unmount(skipDOM), { phase: "unmount", context: this.#context });
    }
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;

    moveAfter(parent, this.#anchor, after);

    moveChildrenAfter(parent, this.#anchor, this.#children);
  }
}
