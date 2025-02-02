import { type ElementContext, type MarkupElement } from "../markup.js";
import { isState, MaybeState, type State, type StopFunction } from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

/**
 * Manages several MarkupElements as one.
 */
export class Outlet implements MarkupElement {
  [TYPE_MARKUP_ELEMENT] = true;

  node = document.createTextNode("");
  isMounted = false;

  source: MaybeState<MarkupElement[]>;
  elements: MarkupElement[] = [];

  stopCallback?: StopFunction;

  constructor(source: MaybeState<MarkupElement[]>) {
    this.source = source;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.node, after?.nextSibling ?? null);

      if (isState<MarkupElement[]>(this.source)) {
        this.stopCallback = this.source.watch((children) => {
          this.update(children);
        });
      } else {
        this.update(this.elements);
      }
    }
  }

  unmount(parentIsUnmounting = false) {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
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

    for (let i = 0; i < newElements.length; i++) {
      const element = newElements[i];
      const previous = i > 0 ? this.elements[i - 1] : undefined;
      element.mount(this.node.parentElement!, previous?.node);
      this.elements.push(element);
    }
  }
}
