import { type MarkupElement } from "../markup.js";
import { isReactive, get, effect, type MaybeReactive, type UnsubscribeFunction, peek } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/**
 * Manages several MarkupElements as one.
 */
export class Outlet implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  isMounted = false;

  private source: MaybeReactive<MarkupElement[]>;
  private elements: MarkupElement[] = [];

  private unsubscribe?: UnsubscribeFunction;

  constructor(source: MaybeReactive<MarkupElement[]>) {
    this.source = source;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.node, after?.nextSibling ?? null);

      if (isReactive<MarkupElement[]>(this.source)) {
        this.unsubscribe = effect(() => {
          this.update(get(this.source));
        });
      } else {
        this.update(this.elements);
      }
    }
  }

  unmount(parentIsUnmounting = false) {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }

    if (this.isMounted) {
      this.cleanup(parentIsUnmounting);
      this.isMounted = false;
    }
  }

  private cleanup(parentIsUnmounting: boolean) {
    for (const element of this.elements) {
      element.unmount(parentIsUnmounting);
    }
    this.elements = [];
  }

  private update(newElements: MarkupElement[]) {
    this.cleanup(false);

    if (newElements.length > 0) {
      for (let i = 0; i < newElements.length; i++) {
        const element = newElements[i];
        const previous = i > 0 ? this.elements[i - 1] : undefined;
        element.mount(this.node.parentElement!, previous?.node);
        this.elements.push(element);
      }

      this.node.parentNode?.insertBefore(this.node, this.elements.at(-1)?.node ?? null);
    }
  }
}
