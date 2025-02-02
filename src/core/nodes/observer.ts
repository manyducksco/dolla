import { isArray, typeOf } from "../../typeChecking.js";
import type { Renderable } from "../../types.js";
import {
  constructMarkup,
  groupElements,
  isMarkup,
  isMarkupElement,
  isRenderable,
  toMarkup,
  type ElementContext,
  type MarkupElement,
} from "../markup.js";
import { createWatcher, type State } from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

interface ObserverOptions {
  elementContext: ElementContext;
  states: State<any>[];
  renderFn: (...values: any) => Renderable;
}

/**
 * Displays dynamic children without a parent element.
 * Used when a State is passed as a child in a view template.
 */
export class Observer implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node: Node;
  endNode: Node;
  children: MarkupElement[] = [];
  renderFn: (...values: any) => Renderable;
  elementContext;
  watcher = createWatcher();

  sources;

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ states, renderFn, elementContext }: ObserverOptions) {
    this.elementContext = elementContext;
    this.renderFn = renderFn;

    this.sources = states;

    this.node = document.createComment("Observer");
    this.endNode = document.createComment("/Observer");
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.watcher.watch(this.sources, (...values) => {
        const rendered = this.renderFn(...values);

        if (!isRenderable(rendered)) {
          console.error(rendered, values);
          throw new TypeError(
            `Observer received invalid value to render. Got type: ${typeOf(rendered)}, value: ${rendered}`,
          );
        }

        this.update(isArray(rendered) ? rendered : [rendered]);
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    this.watcher.stopAll();

    if (this.isMounted) {
      this.cleanup(parentIsUnmounting);
      this.node.parentNode?.removeChild(this.node);
    }
  }

  cleanup(parentIsUnmounting: boolean) {
    for (const element of this.children) {
      element.unmount(parentIsUnmounting);
    }
    this.children = [];
  }

  update(children: Renderable[]) {
    this.cleanup(false);

    if (children == null || !this.isMounted) {
      return;
    }

    const newElements: MarkupElement[] = children.map((c) => {
      if (isMarkupElement(c)) {
        return c;
      } else if (isMarkup(c)) {
        return groupElements(constructMarkup(this.elementContext, c));
      } else {
        return groupElements(constructMarkup(this.elementContext, toMarkup(c)));
      }
    });

    for (const element of newElements) {
      const previous = this.children.at(-1)?.node || this.node;
      element.mount(this.node.parentNode!, previous);
      this.children.push(element);
    }

    // Move marker comment node to after last sibling in dev mode.
    if (this.elementContext.root.getEnv() === "development") {
      const lastNode = this.children.at(-1)?.node;
      if (this.endNode.previousSibling !== lastNode) {
        this.node.parentNode!.insertBefore(this.endNode, lastNode?.nextSibling ?? null);
      }
    }
  }
}
