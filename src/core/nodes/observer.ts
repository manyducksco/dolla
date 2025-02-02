import { isArray, typeOf } from "../../typeChecking.js";
import type { Renderable } from "../../types.js";
import { getUniqueId } from "../../utils.js";
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
import { createWatcher, type MaybeState } from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

interface ObserverOptions {
  elementContext: ElementContext;
  sources: MaybeState<any>[];
  renderFn: (...values: any) => Renderable;
}

/**
 * Displays dynamic children without a parent element.
 * Used when a State is passed as a child in a view template.
 */
export class Observer implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  children: MarkupElement[] = [];
  renderFn: (...values: any) => Renderable;
  elementContext;
  watcher = createWatcher();

  sources: MaybeState<any>[];

  get isMounted() {
    return this.node.parentNode != null;
  }

  constructor({ sources, renderFn, elementContext }: ObserverOptions) {
    this.elementContext = elementContext;
    this.renderFn = renderFn;

    this.sources = sources;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.node, after?.nextSibling ?? null);

      this.watcher.watch(this.sources, (...values) => {
        const content = this.renderFn(...values);

        if (!isRenderable(content)) {
          console.error(content, values);
          throw new TypeError(
            `Observer received invalid value to render. Got type: ${typeOf(content)}, value: ${content}`,
          );
        }

        this.update(isArray(content) ? content : [content]);
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

    if (children == null || children.length === 0 || !this.isMounted) {
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

    // Move marker node to end.
    const parent = this.node.parentNode!;
    const lastChildNextSibling = this.children.at(-1)?.node?.nextSibling ?? null;
    parent.insertBefore(this.node, lastChildNextSibling);
  }
}
