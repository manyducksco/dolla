import { type AppContext, type ElementContext } from "../app.js";
import { getRenderHandle, isDOMHandle, isMarkup, renderMarkupToDOM, toMarkup, type DOMHandle } from "../markup.js";
import { type Renderable } from "../types.js";

interface PortalConfig {
  content: Renderable;
  parent: Node;
  appContext: AppContext;
  elementContext: ElementContext;
}

/**
 * Renders content into a specified parent node.
 */
export class Portal implements DOMHandle {
  config: PortalConfig;
  handle?: DOMHandle;

  get connected() {
    if (!this.handle) {
      return false;
    }
    return this.handle.connected;
  }

  constructor(config: PortalConfig) {
    this.config = config;
  }

  connect(_parent: Node, _after?: Node) {
    const { content, parent } = this.config;

    if (isDOMHandle(content)) {
      this.handle = content;
    } else if (isMarkup(content)) {
      this.handle = getRenderHandle(renderMarkupToDOM(content, this.config));
    } else {
      this.handle = getRenderHandle(renderMarkupToDOM(toMarkup(content), this.config));
    }

    this.handle.connect(parent);
  }

  disconnect() {
    if (this.handle?.connected) {
      this.handle.disconnect();
    }
  }

  setChildren(children: DOMHandle[]) {
    this.handle?.setChildren(children);
  }
}
