import { type MarkupElement } from "../markup.js";
import { effect, peek, type Signal, type UnsubscribeFn } from "../signals.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/**
 * Renders the subroute of the nearest view.
 */
export class Outlet implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode = document.createTextNode("");
  isMounted = false;

  private $slot: Signal<MarkupElement | undefined>;
  private mounted?: MarkupElement;

  private unsubscribe?: UnsubscribeFn;

  constructor($slot: Signal<MarkupElement | undefined>) {
    this.$slot = $slot;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        const element = this.$slot();
        peek(() => {
          this.update(element);
        });
      });
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
    if (this.mounted) {
      this.mounted.unmount(parentIsUnmounting);
    }
    this.mounted = undefined;
  }

  private update(element?: MarkupElement) {
    this.cleanup(false);

    if (element) {
      element.mount(this.domNode.parentElement!, this.domNode);
      this.mounted = element;
    }
  }
}
