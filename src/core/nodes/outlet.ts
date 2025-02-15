import { isReactivish, MaybeReactivish, watch } from "../_reactivish.js";
import { type MarkupElement } from "../markup.js";
import { UnsubscribeFunction } from "../reactive.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/**
 * Manages several MarkupElements as one.
 */
export class Outlet implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  isMounted = false;

  source: MaybeReactivish<MarkupElement[]>;
  elements: MarkupElement[] = [];

  unsubscribe?: UnsubscribeFunction;

  constructor(source: MaybeReactivish<MarkupElement[]>) {
    this.source = source;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.node, after?.nextSibling ?? null);

      if (isReactivish<MarkupElement[]>(this.source)) {
        this.unsubscribe = watch(this.source, (children) => {
          this.update(children);
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

  cleanup(parentIsUnmounting: boolean) {
    for (const element of this.elements) {
      element.unmount(parentIsUnmounting);
    }
    this.elements = [];
  }

  update(newElements: MarkupElement[]) {
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
