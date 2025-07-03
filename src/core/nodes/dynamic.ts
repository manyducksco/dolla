import { toArray } from "../../utils.js";
import type { Context } from "../context.js";
import { toMarkupNodes } from "../markup.js";
import { effect, Signal, INTERNAL_EFFECT, type UnsubscribeFn } from "../signals.js";
import { MarkupNode } from "./_markup.js";

/**
 * Renders any kind of content; markup, signals, DOM nodes, etc.
 * If it can be rendered by Dolla then Dynamic will do it.
 */
export class DynamicNode extends MarkupNode {
  private root = document.createTextNode("");

  private children: MarkupNode[] = [];
  private context: Context;

  private slot: Signal<any>;
  private unsubscribe?: UnsubscribeFn;

  constructor(context: Context, slot: Signal<any>) {
    super();
    this.context = context;
    this.slot = slot;
  }

  override getRoot() {
    return this.root;
  }

  override isMounted() {
    return this.root.parentElement != null;
  }

  override mount(parent: Node, after?: Node) {
    if (!this.isMounted()) {
      parent.insertBefore(this.root, after?.nextSibling ?? null);

      this.unsubscribe = effect(
        () => {
          try {
            const content = this.slot();
            this.update(toArray(content));
          } catch (error) {
            this.context.crash(error as Error);
          }
        },
        { _type: INTERNAL_EFFECT, deps: [this.slot] },
      );
    }
  }

  override unmount(skipDOM = false) {
    this.unsubscribe?.();

    if (this.isMounted()) {
      this.cleanup(skipDOM);
      this.root.parentNode?.removeChild(this.root);
    }
  }

  override move(parent: Element, after?: Node) {
    if ("moveBefore" in parent) {
      try {
        (parent as any).moveBefore(this.root, after?.nextSibling ?? null);
        for (let i = 0; i < this.children.length; i++) {
          this.children[i].move(parent, this.children[i - 1]?.getRoot() ?? this.root);
        }
        (parent as any).moveBefore(this.root, this.children.at(-1)?.getRoot()?.nextSibling ?? null);
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
      const previous = this.children.at(-1)?.getRoot() || this.root;
      node.mount(this.root.parentElement!, previous);
      this.children.push(node);
    }

    // Move marker after children
    const parent = this.root.parentElement!;
    const lastChildNextSibling = this.children.at(-1)?.getRoot()?.nextSibling ?? null;
    if ("moveBefore" in parent) {
      (parent as any).moveBefore(this.root, lastChildNextSibling);
    } else {
      parent.insertBefore(this.root, lastChildNextSibling);
    }
  }
}
