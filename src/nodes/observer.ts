import {
  constructMarkup,
  isMarkup,
  isMarkupElement,
  isRenderable,
  groupElements,
  toMarkup,
  type ElementContext,
  type MarkupElement,
} from "../markup.js";
import { createWatcher, type State, type StopFunction } from "../state.js";
import { typeOf } from "../typeChecking.js";
import type { Renderable } from "../types.js";

interface ObserverOptions {
  elementContext: ElementContext;
  states: State<any>[];
  renderFn: (...values: any) => Renderable;
}

/**
 * Displays dynamic children without a parent element.
 */
export class Observer implements MarkupElement {
  node: Node;
  endNode: Node;
  connectedViews: MarkupElement[] = [];
  renderFn: (...values: any) => Renderable;
  elementContext;
  observerControls;
  watcher = createWatcher();

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ states, renderFn, elementContext }: ObserverOptions) {
    this.elementContext = elementContext;
    this.renderFn = renderFn;

    this.node = document.createComment("Observer");
    this.endNode = document.createComment("/Observer");

    let _stop: StopFunction | undefined;

    this.observerControls = {
      start: () => {
        if (_stop != null) return;

        _stop = this.watcher.watch(states, (...values) => {
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

  unmount(parentIsUnmounting = false) {
    this.observerControls.stop();
    this.watcher.stopAll();

    if (this.isMounted) {
      this.cleanup(parentIsUnmounting);
      this.node.parentNode?.removeChild(this.node);
    }
  }

  cleanup(parentIsUnmounting: boolean) {
    while (this.connectedViews.length > 0) {
      this.connectedViews.pop()?.unmount(parentIsUnmounting);
    }
  }

  update(...children: Renderable[]) {
    this.cleanup(false);

    if (children == null || !this.isMounted) {
      return;
    }

    const nodes: MarkupElement[] = children.map((c) => {
      if (isMarkupElement(c)) {
        return c;
      } else if (isMarkup(c)) {
        return groupElements(constructMarkup(this.elementContext, c));
      } else {
        return groupElements(constructMarkup(this.elementContext, toMarkup(c)));
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
