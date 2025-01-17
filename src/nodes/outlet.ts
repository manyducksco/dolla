import { type MarkupNode, type ElementContext } from "../markup.js";
import { type State, type StopFunction } from "../state.js";

export interface OutletConfig {
  $children: State<MarkupNode[]>;
  elementContext: ElementContext;
}

/**
 * Manages an array of DOMHandles.
 */
export class Outlet implements MarkupNode {
  node: Node;
  endNode: Node;
  $children: State<MarkupNode[]>;
  stopCallback?: StopFunction;
  connectedChildren: MarkupNode[] = [];
  elementContext: ElementContext;

  constructor(config: OutletConfig) {
    this.$children = config.$children;
    this.elementContext = config.elementContext;

    if (this.elementContext.root.getEnv() === "development") {
      this.node = document.createComment("Outlet");
      this.endNode = document.createComment("/Outlet");
    } else {
      this.node = document.createTextNode("");
      this.endNode = document.createTextNode("");
    }
  }

  get isMounted() {
    return this.node?.parentNode != null;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.stopCallback = this.$children.watch((children) => {
        this.update(children);
      });
    }
  }

  unmount() {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.isMounted) {
      for (const child of this.connectedChildren) {
        child.unmount();
      }
      this.connectedChildren = [];
      this.endNode.parentNode?.removeChild(this.endNode);
    }
  }

  update(newChildren: MarkupNode[]) {
    for (const child of this.connectedChildren) {
      child.unmount();
    }

    for (let i = 0; i < newChildren.length; i++) {
      const child = newChildren[i];
      const previous = i > 0 ? newChildren[i] : undefined;
      child.mount(this.node.parentElement!, previous?.node);
    }

    this.connectedChildren = newChildren;

    if (this.elementContext.root.getEnv() === "development") {
      this.node.textContent = `Outlet (${newChildren.length} ${newChildren.length === 1 ? "child" : "children"})`;
      this.node.parentElement?.insertBefore(
        this.endNode,
        this.connectedChildren[this.connectedChildren.length - 1]?.node?.nextSibling ?? null,
      );
    }
  }
}
