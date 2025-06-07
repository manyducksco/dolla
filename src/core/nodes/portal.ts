import type { Renderable } from "../../types.js";
import { Context } from "../context.js";
import { render, type MarkupNode } from "../markup.js";
import { IS_MARKUP_NODE } from "../symbols.js";

/**
 * Renders content into a specified parent node.
 */
export class Portal implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  private context;
  private content;
  private parent;

  private element?: MarkupNode;

  get isMounted() {
    if (!this.element) {
      return false;
    }
    return this.element.isMounted;
  }

  constructor(context: Context, content: Renderable, parent: Node) {
    this.context = context;
    this.content = content;
    this.parent = parent;
  }

  mount(_parent: Node, _after?: Node) {
    this.element = render(this.content, this.context);
    this.element.mount(this.parent);
  }

  unmount(parentIsUnmounting = false) {
    if (this.element?.isMounted) {
      // Portals MUST unmount DOM nodes because they won't be removed by parents unmounting.
      this.element.unmount(false);
    }
  }
}
