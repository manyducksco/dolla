import {
  getRenderHandle,
  isDOMHandle,
  isMarkup,
  isRenderable,
  renderMarkupToDOM,
  toMarkup,
  type DOMHandle,
  type ElementContext,
} from "../markup.js";
import { Environment, getEnv } from "../modules/core.js";
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
export class Observer implements DOMHandle {
  node: Node;
  endNode: Node;
  connectedViews: DOMHandle[] = [];
  renderFn: (...values: any) => Renderable;
  elementContext;
  observerControls;

  get connected() {
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

  connect(parent: Node, after?: Node) {
    if (!this.connected) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);
      this.observerControls.start();
    }
  }

  disconnect() {
    this.observerControls.stop();

    if (this.connected) {
      this.cleanup();
      this.node.parentNode?.removeChild(this.node);
    }
  }

  async setChildren() {
    console.warn("setChildren is not implemented for Dynamic");
  }

  cleanup() {
    while (this.connectedViews.length > 0) {
      this.connectedViews.pop()?.disconnect();
    }
  }

  update(...children: Renderable[]) {
    this.cleanup();

    if (children == null || !this.connected) {
      return;
    }

    const handles: DOMHandle[] = children.map((c) => {
      if (isDOMHandle(c)) {
        return c;
      } else if (isMarkup(c)) {
        return getRenderHandle(renderMarkupToDOM(c, this.elementContext));
      } else {
        return getRenderHandle(renderMarkupToDOM(toMarkup(c), this.elementContext));
      }
    });

    for (const handle of handles) {
      const previous = this.connectedViews.at(-1)?.node || this.node;

      handle.connect(this.node.parentNode!, previous);

      this.connectedViews.push(handle);
    }

    // Move marker comment node to after last sibling.
    if (getEnv() === Environment.development) {
      const lastNode = this.connectedViews.at(-1)?.node;
      if (this.endNode.previousSibling !== lastNode) {
        this.node.parentNode!.insertBefore(this.endNode, lastNode?.nextSibling ?? null);
      }
    }
  }
}
