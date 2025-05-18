import { isFunction } from "../../typeChecking.js";
import { type MarkupElement } from "../markup.js";
import { effect, get, peek, type MaybeSignal, type UnsubscribeFunction } from "../signals-api.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/**
 * Manages several MarkupElements as one.
 */
export class Fragment implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode = document.createTextNode("");
  isMounted = false;

  private source: MaybeSignal<MarkupElement[]>;
  private elements: MarkupElement[] = [];

  private unsubscribe?: UnsubscribeFunction;

  constructor(source: MaybeSignal<MarkupElement[]>) {
    this.source = source;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      if (isFunction(this.source)) {
        this.unsubscribe = effect(() => {
          const value = get(this.source);
          peek(() => {
            this.update(value);
          });
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
        element.mount(this.domNode.parentElement!, previous?.domNode);
        this.elements.push(element);
      }

      this.domNode.parentNode?.insertBefore(this.domNode, this.elements.at(-1)?.domNode ?? null);
    }
  }
}
