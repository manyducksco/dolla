import { isArray } from "../../typeChecking.js";
import type { Context } from "../context.js";
import { toMarkupNodes, type MarkupNode } from "../markup.js";
import { effect, peek, Signal, type UnsubscribeFn } from "../signals.js";
import { IS_MARKUP_NODE } from "../symbols.js";

/**
 * Displays dynamic children without a parent element.
 * Renders a Reactive value via a render function.
 *
 * This is probably the most used element type aside from HTML.
 */
export class Dynamic implements MarkupNode {
  [IS_MARKUP_NODE] = true;

  root = document.createTextNode("");

  private children: MarkupNode[] = [];
  private context: Context;

  private $slot: Signal<any>;
  private unsubscribe?: UnsubscribeFn;

  get isMounted() {
    return this.root.parentNode != null;
  }

  constructor(context: Context, $slot: Signal<any>) {
    this.context = context;
    this.$slot = $slot;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted) {
      parent.insertBefore(this.root, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        try {
          const content = this.$slot();
          peek(() => {
            this.update(isArray(content) ? content : [content]);
          });
        } catch (error) {
          this.context.error(error);
          this.context.crash(error as Error);
        }
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    this.unsubscribe?.();

    if (this.isMounted) {
      this.cleanup(parentIsUnmounting);
      this.root.parentNode?.removeChild(this.root);
    }
  }

  private cleanup(parentIsUnmounting: boolean) {
    for (const element of this.children) {
      element.unmount(parentIsUnmounting);
    }
    this.children = [];
  }

  private update(content: any[]) {
    this.cleanup(false);

    if (content.length === 0 || !this.isMounted) return;

    const elements = toMarkupNodes(this.context, content);

    for (const element of elements) {
      const previous = this.children.at(-1)?.root || this.root;
      element.mount(this.root.parentNode!, previous);
      this.children.push(element);
    }

    this.moveMarker();
  }

  /**
   * Move marker node to end of children.
   */
  private moveMarker() {
    const parent = this.root.parentNode!;
    const lastChildNextSibling = this.children.at(-1)?.root?.nextSibling ?? null;
    if ("moveBefore" in parent) {
      (parent.moveBefore as any)(this.root, lastChildNextSibling);
    } else {
      parent.insertBefore(this.root, lastChildNextSibling);
    }
  }
}
