import { type ElementContext, type AppContext } from "../app.js";
import { type DOMHandle } from "../markup.js";
import { observe, type Readable, type StopFunction } from "../state.js";

export interface OutletConfig {
  $children: Readable<DOMHandle[]>;
  appContext: AppContext;
  elementContext: ElementContext;
}

/**
 * Manages an array of DOMHandles.
 */
export class Outlet implements DOMHandle {
  node: Node;
  endNode: Node;
  $children: Readable<DOMHandle[]>;
  stopCallback?: StopFunction;
  connectedChildren: DOMHandle[] = [];
  appContext: AppContext;
  elementContext: ElementContext;

  constructor(config: OutletConfig) {
    this.$children = config.$children;
    this.appContext = config.appContext;
    this.elementContext = config.elementContext;

    if (this.appContext.mode === "development") {
      this.node = document.createComment("Outlet");
      this.endNode = document.createComment("/Outlet");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  get connected() {
    return this.node?.parentNode != null;
  }

  connect(parent: Node, after?: Node | undefined) {
    if (!this.connected) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.stopCallback = observe(this.$children, (children) => {
        this.update(children);
      });
    }
  }

  disconnect() {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.connected) {
      for (const child of this.connectedChildren) {
        child.disconnect();
      }
      this.connectedChildren = [];
      this.endNode.parentNode?.removeChild(this.endNode);
    }
  }

  update(newChildren: DOMHandle[]) {
    for (const child of this.connectedChildren) {
      child.disconnect();
    }

    this.connectedChildren = newChildren;

    for (let i = 0; i < this.connectedChildren.length; i++) {
      const child = this.connectedChildren[i];
      const previous = i > 0 ? this.connectedChildren[i] : undefined;
      child.connect(this.node.parentElement!, previous?.node);
    }

    if (this.appContext.mode === "development") {
      this.node.textContent = `Outlet (${newChildren.length} ${newChildren.length === 1 ? "child" : "children"})`;
      this.node.parentElement?.insertBefore(
        this.endNode,
        this.connectedChildren[this.connectedChildren.length - 1]?.node?.nextSibling ?? null
      );
    }
  }

  setChildren(children: DOMHandle[]) {}
}
