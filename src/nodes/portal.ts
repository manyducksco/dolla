import {
  mergeElements as mergeElements,
  isMarkupElement,
  isMarkup,
  constructMarkup,
  toMarkup,
  type MarkupElement,
  type ElementContext,
} from "../markup.js";
import { type Renderable } from "../types.js";

interface PortalConfig {
  content: Renderable;
  parent: Node;
  elementContext: ElementContext;
}

/**
 * Renders content into a specified parent node.
 */
export class Portal implements MarkupElement {
  config: PortalConfig;
  element?: MarkupElement;

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
    } else if (isMarkup(content)) {
      this.element = mergeElements(constructMarkup(this.config.elementContext, content));
    } else {
      this.element = mergeElements(constructMarkup(this.config.elementContext, toMarkup(content)));
    }

    this.element.mount(parent);
  }

  unmount(parentIsUnmounting: boolean) {
    if (this.element?.isMounted) {
      this.element.unmount(parentIsUnmounting);
    }
  }
}
