import { type MarkupElement } from "../markup.js";
import { effect, peek, type Signal, type UnsubscribeFunction } from "../signals-api.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";
import { View } from "./view.js";

/**
 * Renders the subroute of the nearest view.
 */
export class Outlet implements MarkupElement {
  [IS_MARKUP_ELEMENT] = true;

  domNode = document.createTextNode("");
  isMounted = false;

  private view: Signal<View<{}> | undefined>;
  private mountedView?: View<{}>;

  private unsubscribe?: UnsubscribeFunction;

  constructor(view: Signal<View<{}> | undefined>) {
    this.view = view;
  }

  mount(parent: Node, after?: Node | undefined) {
    if (!this.isMounted) {
      this.isMounted = true;

      parent.insertBefore(this.domNode, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        const view = this.view();
        peek(() => {
          this.update(view);
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
    if (this.mountedView) {
      this.mountedView.unmount(parentIsUnmounting);
    }
    this.mountedView = undefined;
  }

  private update(view?: View<{}>) {
    this.cleanup(false);

    if (view) {
      view.mount(this.domNode.parentElement!, this.domNode);
      this.mountedView = view;
    }
  }
}
