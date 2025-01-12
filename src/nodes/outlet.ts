import { type DOMHandle, type ElementContext } from "../markup.js";
import { type Signal, type StopFunction } from "../signals.js";

export interface OutletConfig {
  $children: Signal<DOMHandle[]>;
  elementContext: ElementContext;
}

/**
 * Manages an array of DOMHandles.
 */
export class Outlet implements DOMHandle {
  node: Node;
  endNode: Node;
  $children: Signal<DOMHandle[]>;
  stopCallback?: StopFunction;
  connectedChildren: DOMHandle[] = [];
  elementContext: ElementContext;

  constructor(config: OutletConfig) {
    this.$children = config.$children;
    this.elementContext = config.elementContext;

    if (this.elementContext.dolla.env === "development") {
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

      this.stopCallback = this.$children.watch((children) => {
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

    for (let i = 0; i < newChildren.length; i++) {
      const child = newChildren[i];
      const previous = i > 0 ? newChildren[i] : undefined;
      child.connect(this.node.parentElement!, previous?.node);
    }

    this.connectedChildren = newChildren;

    if (this.elementContext.dolla.env === "development") {
      this.node.textContent = `Outlet (${newChildren.length} ${newChildren.length === 1 ? "child" : "children"})`;
      this.node.parentElement?.insertBefore(
        this.endNode,
        this.connectedChildren[this.connectedChildren.length - 1]?.node?.nextSibling ?? null,
      );
    }
  }

  setChildren(children: DOMHandle[]) {
    throw new Error(`setChildren is not supported on Outlet`);
  }
}
