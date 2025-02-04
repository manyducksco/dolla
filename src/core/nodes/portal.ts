import { type Renderable } from "../../types.js";
import {
  constructMarkup,
  groupElements,
  isMarkup,
  isMarkupElement,
  toMarkup,
  type ElementContext,
  type MarkupElement,
} from "../markup.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

interface PortalConfig {
  content: Renderable;
  parent: Node;
  elementContext: ElementContext;
}

/**
 * Renders content into a specified parent node.
 */
export class Portal implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

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
    } else {
      this.element = groupElements(constructMarkup(this.config.elementContext, toMarkup(content)));
    }

    this.element.mount(parent);
  }

  unmount(parentIsUnmounting = false) {
    if (this.element?.isMounted) {
      this.element.unmount(parentIsUnmounting);
    }
  }
}
