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

  elements: MaybeState<MarkupElement[]>;
  children: MarkupElement[] = [];

  stopCallback?: StopFunction;

  constructor(elements: MaybeState<MarkupElement[]>) {
    this.elements = elements;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.node, after?.nextSibling ?? null);

      if (isState<MarkupElement[]>(this.elements)) {
        this.stopCallback = this.elements.watch((children) => {
          this.update(children);
        });
      } else {
        this.update(this.children);
      }
    }
  }

  unmount(parentIsUnmounting = false) {
    if (this.stopCallback) {
      this.stopCallback();
      this.stopCallback = undefined;
    }

    if (this.isMounted) {
      for (const child of this.children) {
        child.unmount(parentIsUnmounting);
      }
      this.children = [];

      this.isMounted = false;
    }
  }

  update(newChildren: MarkupElement[]) {
    for (const child of this.children) {
      child.unmount(false);
    }

    for (let i = 0; i < newChildren.length; i++) {
      const child = newChildren[i];
      const previous = i > 0 ? newChildren[i] : undefined;
      child.mount(this.node.parentElement!, previous?.node);
    }

    this.children = newChildren;
  }
}
