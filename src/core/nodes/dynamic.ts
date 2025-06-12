import { toArray } from "../../utils.js";
import type { Context } from "../context.js";
import { toMarkupNodes, type MarkupNode } from "../markup.js";
import { effect, untracked, type Signal, type UnsubscribeFn } from "../signals.js";
import { MARKUP_NODE, TYPE } from "../symbols.js";

/**
 * Displays dynamic children without a parent element.
 * Renders a Reactive value via a render function.
 *
 * This is probably the most used element type aside from HTML.
 */
export class Dynamic implements MarkupNode {
  [TYPE] = MARKUP_NODE;

  root = document.createTextNode("");

  private children: MarkupNode[] = [];
  private context: Context;

  private $slot: Signal<any>;
  private unsubscribe?: UnsubscribeFn;

  constructor(context: Context, $slot: Signal<any>) {
    this.context = context;
    this.$slot = $slot;
  }

  isMounted() {
    return this.root.parentElement != null;
  }

  mount(parent: Node, after?: Node) {
    if (!this.isMounted()) {
      parent.insertBefore(this.root, after?.nextSibling ?? null);

      this.unsubscribe = effect(() => {
        try {
          const content = this.$slot();
          untracked(() => {
            this.update(toArray(content));
          });
        } catch (error) {
          this.context.crash(error as Error);
        }
      });
    }
  }

  unmount(skipDOM = false) {
    this.unsubscribe?.();

    if (this.isMounted()) {
      this.cleanup(skipDOM);
      this.root.parentNode?.removeChild(this.root);
    }
  }

  move(parent: Element, after?: Node) {
    if ("moveBefore" in parent) {
      try {
        (parent as any).moveBefore(this.root, after?.nextSibling ?? null);
        for (let i = 0; i < this.children.length; i++) {
          this.children[i].move(parent, this.children[i - 1]?.root ?? this.root);
        }
        (parent as any).moveBefore(this.root, this.children.at(-1)?.root?.nextSibling ?? null);
      } catch {
        this.mount(parent, after);
      }
    } else {
      this.mount(parent, after);
    }
  }

  private cleanup(skipDOM: boolean) {
    for (const element of this.children) {
      if (element.isMounted()) element.unmount(skipDOM);
    }
    this.children.length = 0;
  }

  private update(content: any[]) {
    this.cleanup(false);

    if (content.length === 0 || !this.isMounted()) return;

    const nodes = toMarkupNodes(this.context, content);

    for (const node of nodes) {
      const previous = this.children.at(-1)?.root || this.root;
      node.mount(this.root.parentElement!, previous);
      this.children.push(node);
    }

    this.moveMarker();
  }

  /**
   * Move marker node to end of children.
   */
  private moveMarker() {
    const parent = this.root.parentElement!;
    const lastChildNextSibling = this.children.at(-1)?.root?.nextSibling ?? null;
    if ("moveBefore" in parent) {
      (parent as any).moveBefore(this.root, lastChildNextSibling);
    } else {
      parent.insertBefore(this.root, lastChildNextSibling);
    }
  }
}
