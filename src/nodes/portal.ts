import {
  mergeNodes,
  isNode,
  isMarkup,
  constructMarkup,
  toMarkup,
  type MarkupNode,
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
export class Portal implements MarkupNode {
  config: PortalConfig;
  handle?: MarkupNode;

  get isMounted() {
    if (!this.handle) {
      return false;
    }
    return this.handle.isMounted;
  }

  constructor(config: PortalConfig) {
    this.config = config;
  }

  mount(_parent: Node, _after?: Node) {
    const { content, parent } = this.config;

    if (isNode(content)) {
      this.handle = content;
    } else if (isMarkup(content)) {
      this.handle = mergeNodes(constructMarkup(this.config.elementContext, content));
    } else {
      this.handle = mergeNodes(constructMarkup(this.config.elementContext, toMarkup(content)));
    }

    this.handle.mount(parent);
  }

  unmount() {
    if (this.handle?.isMounted) {
      this.handle.unmount();
    }
  }
}
