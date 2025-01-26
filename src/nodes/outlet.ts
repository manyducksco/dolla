import { type MarkupElement, type ElementContext } from "../markup.js";
import { type State, type StopFunction } from "../state.js";

export interface OutletConfig {
  $children: State<MarkupElement[]>;
  elementContext: ElementContext;
}

/**
 * Manages an array of DOMHandles.
 */
export class Outlet implements MarkupElement {
  node: Node;
  endNode: Node;
  $children: State<MarkupElement[]>;
  stopCallback?: StopFunction;
  mountedChildren: MarkupElement[] = [];
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

  unmount(parentIsUnmounting: boolean) {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.isMounted) {
      for (const child of this.mountedChildren) {
        child.unmount(parentIsUnmounting);
      }
      this.mountedChildren = [];
      this.endNode.parentNode?.removeChild(this.endNode);
    }
  }

  update(newChildren: MarkupElement[]) {
    for (const child of this.mountedChildren) {
      child.unmount(false);
    }

    for (let i = 0; i < newChildren.length; i++) {
      const child = newChildren[i];
      const previous = i > 0 ? newChildren[i] : undefined;
      child.mount(this.node.parentElement!, previous?.node);
    }

    this.mountedChildren = newChildren;

    if (this.elementContext.root.getEnv() === "development") {
      this.node.textContent = `Outlet (${newChildren.length} ${newChildren.length === 1 ? "child" : "children"})`;
      this.node.parentElement?.insertBefore(
        this.endNode,
        this.mountedChildren[this.mountedChildren.length - 1]?.node?.nextSibling ?? null,
      );
    }
  }
}
