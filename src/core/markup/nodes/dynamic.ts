import { addChild, createTextNode } from "../../../utils.js";
import type { Context } from "../../context.js";
import { subscribe, type Getter } from "../../signals.js";
import { scheduleUpdate } from "../scheduler.js";
import { MarkupNode, MountTarget } from "../types.js";
import { toMarkupNodes } from "../utils.js";
import { DOMNode } from "./dom.js";

/**
 * Renders any kind of content; markup, signals, DOM nodes, etc.
 * If it can be rendered by Dolla then Dynamic will do it.
 */

export class DynamicNode extends MarkupNode {
  #root = createTextNode("");
  #children: MarkupNode[] = [];
  #context: Context;
  #slot: Getter<any>;
  #unsubscribe?: () => void;

  constructor(context: Context, slot: Getter<any>) {
    super();
    this.#context = context;
    this.#slot = slot;
  }

  override getRoot() {
    return this.#root;
  }

  override isMounted() {
    return this.#root.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node) {
    if (!this.isMounted()) {
      addChild(parent, this.#root, after);

      this.#unsubscribe = subscribe(this.#slot, (content) => {
        scheduleUpdate(() => {
          this.#update(content);
        });
      });
    }
  }

  override unmount(skipDOM = false) {
    this.#unsubscribe?.();

    if (this.isMounted()) {
      if (!skipDOM) {
        this.#root.parentNode?.removeChild(this.#root);
      }
      this.#cleanup(skipDOM);
    }
  }

  override move(parent: Element, after?: Node) {
    let referenceNode: Node | null = after?.nextSibling ?? null;

    if ("moveBefore" in parent) {
      try {
        (parent as any).moveBefore(this.#root, referenceNode);
        referenceNode = this.#root.nextSibling;

        for (let i = 0; i < this.#children.length; i++) {
          const childRoot = this.#children[i].getRoot();
          if (childRoot) {
            (parent as any).moveBefore(childRoot, referenceNode);
          }
        }
        return;
      } catch {
        // Fallthrough to standard insertBefore
      }
    }

    // Standard DOM fallback (moves root AND children)
    parent.insertBefore(this.#root, referenceNode);
    referenceNode = this.#root.nextSibling;

    for (let i = 0; i < this.#children.length; i++) {
      this.#children[i].move(parent, this.#children[i - 1]?.getRoot() ?? this.#root);
    }
  }

  #cleanup(skipDOM: boolean) {
    for (let i = 0; i < this.#children.length; i++) {
      this.#children[i].unmount(skipDOM);
    }
    this.#children.length = 0;
  }

  #update(content: any) {
    if (!this.isMounted()) return;

    // Fast-path for primitive text updates
    const isPrimitive = typeof content === "string" || typeof content === "number";
    if (isPrimitive && this.#children.length === 1) {
      const child = this.#children[0];
      if (child instanceof DOMNode) {
        const domNode = child.getRoot();
        if (domNode && domNode.nodeType === Node.TEXT_NODE) {
          domNode.nodeValue = String(content);
          return;
        }
      }
    }

    this.#cleanup(false);

    if (content == null || content === false) return;

    const nodes = toMarkupNodes(this.#context, content);

    const parent = this.#root.parentElement!;
    let referenceNode: Node = this.#root;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.mount(parent, referenceNode);
      this.#children.push(node);

      const nextRoot = node.getRoot();
      if (nextRoot) referenceNode = nextRoot;
    }
  }
}
