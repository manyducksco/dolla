import type { Renderable } from "../../types.js";
import { Context } from "../context.js";
import { toMarkupElements, groupElements, isMarkupElement, toMarkup, type MarkupElement } from "../markup.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

interface PortalConfig {
  content: Renderable;
  parent: Node;
  context: Context;
}

/**
 * Renders content into a specified parent node.
 */
export class Portal implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  private config: PortalConfig;
  private element?: MarkupElement;

  get isMounted() {
    if (!this.element) {
      return false;
    }
    return this.element.isMounted;
  }

  constructor(config: PortalConfig) {
    this.config = config;
  }

  mount(_parent: Node, _after?: Node) {
    const { content, parent } = this.config;

    if (isMarkupElement(content)) {
      this.element = content;
    } else {
      this.element = groupElements(toMarkupElements(this.config.context, toMarkup(content)));
    }

    this.element.mount(parent);
  }

  unmount(parentIsUnmounting = false) {
    if (this.element?.isMounted) {
      // Portals MUST unmount DOM nodes because they won't be removed by parents unmounting.
      this.element.unmount(false);
    }
  }
}
