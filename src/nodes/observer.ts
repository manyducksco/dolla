import {
  mergeNodes,
  isNode,
  isMarkup,
  isRenderable,
  constructMarkup,
  toMarkup,
  type MarkupNode,
  type ElementContext,
} from "../markup.js";
import { watch, type Signal, type StopFunction } from "../signals.js";
import { typeOf } from "../typeChecking.js";
import type { Renderable } from "../types.js";

interface ObserverOptions {
  elementContext: ElementContext;
  signals: Signal<any>[];
  renderFn: (...values: any) => Renderable;
}

/**
 * Displays dynamic children without a parent element.
 */
export class Observer implements MarkupNode {
  node: Node;
  endNode: Node;
  connectedViews: MarkupNode[] = [];
  renderFn: (...values: any) => Renderable;
  elementContext;
  observerControls;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ signals, renderFn, elementContext }: ObserverOptions) {
    this.elementContext = elementContext;
    this.renderFn = renderFn;

    this.node = document.createComment("Observer");
    this.endNode = document.createComment("/Observer");

    let _stop: StopFunction | undefined;

    this.observerControls = {
      start: () => {
        if (_stop != null) return;

        _stop = watch(signals, (...values) => {
          const rendered = this.renderFn(...values);

          if (!isRenderable(rendered)) {
            console.error(rendered);
            throw new TypeError(
              `Observer received invalid value to render. Got type: ${typeOf(rendered)}, value: ${rendered}`,
            );
          }

          if (Array.isArray(rendered)) {
            this.update(...rendered);
          } else {
            this.update(rendered);
          }
        });
      },
      stop: () => {
        if (_stop == null) return;

        _stop();
        _stop = undefined;
      },
    };
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);
      this.observerControls.start();
    }
  }

  unmount() {
    this.observerControls.stop();

    if (this.isMounted) {
      this.cleanup();
      this.node.parentNode?.removeChild(this.node);
    }
  }

  cleanup() {
    while (this.connectedViews.length > 0) {
      this.connectedViews.pop()?.unmount();
    }
  }

  update(...children: Renderable[]) {
    this.cleanup();

    if (children == null || !this.isMounted) {
      return;
    }

    const nodes: MarkupNode[] = children.map((c) => {
      if (isNode(c)) {
        return c;
      } else if (isMarkup(c)) {
        return mergeNodes(constructMarkup(this.elementContext, c));
      } else {
        return mergeNodes(constructMarkup(this.elementContext, toMarkup(c)));
      }
    });

    for (const node of nodes) {
      const previous = this.connectedViews.at(-1)?.node || this.node;

      node.mount(this.node.parentNode!, previous);

      this.connectedViews.push(node);
    }

    // Move marker comment node to after last sibling in dev mode.
    if (this.elementContext.root.getEnv() === "development") {
      const lastNode = this.connectedViews.at(-1)?.node;
      if (this.endNode.previousSibling !== lastNode) {
        this.node.parentNode!.insertBefore(this.endNode, lastNode?.nextSibling ?? null);
      }
    }
  }
}
