import { isArray } from "../../../utils.js";
import type { Context } from "../../context.js";
import { subscribe, type Getter, withoutOwner } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { flushPendingUpdates, runUpdate, scheduleUpdate, type UpdateMeta } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, lastNodeOf, moveAfter, moveChildrenAfter, toMarkupNodes } from "../utils.js";
import { DOMNode } from "./dom.js";

/**
 * Renders any kind of content; markup, signals, DOM nodes, etc.
 * If it can be rendered by Dolla then Dynamic will do it.
 */

export class DynamicNode extends MarkupNode {
  #root: Text | null = null;
  #children: MarkupNode[] = [];
  #context: Context;
  #slot: Getter<any>;
  #unsubscribe?: () => void;
  #pendingContent: any;
  readonly #meta: UpdateMeta;

  constructor(context: Context, slot: Getter<any>) {
    super();
    this.#context = context;
    this.#slot = slot;
    this.#meta = { label: "DynamicNode", context };
  }

  #updatePending = () => {
    this.#update(this.#pendingContent);
  };

  override getRoot() {
    return this.#root ?? undefined;
  }

  override getLastNode() {
    return lastNodeOf(this.#children, this.#root);
  }

  override isMounted() {
    return this.#root?.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node | null) {
    if (!this.isMounted()) {
      this.#root = createTextNode("");
      addChild(parent, this.#root, after);
      let initial = true;
      let hasInitial = false;
      this.#unsubscribe = withoutOwner(() =>
        subscribe(
          this.#slot,
          (content) => {
            this.#pendingContent = content;
            if (initial) {
              hasInitial = true;
              return;
            }
            scheduleUpdate(this.#updatePending, this.#meta);
          },
          { name: "dynamic", context: this.#context },
        ),
      );
      initial = false;
      // Apply the initial value after the subscription is registered so the
      // node can be safely torn down from inside its own content.
      if (hasInitial) runUpdate(this.#updatePending, this.#meta);
      flushPendingUpdates();
    }
  }

  override unmount(skipDOM = false) {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    if (!skipDOM) {
      this.#root?.parentNode?.removeChild(this.#root);
    }
    // Clean up children even if something else already detached the anchor.
    this.#cleanup(skipDOM);
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#root) return;

    moveAfter(parent, this.#root, after);
    moveChildrenAfter(parent, this.#root, this.#children);
  }

  #cleanup(skipDOM: boolean) {
    const info = { phase: "unmount", context: this.#context } as const;
    for (let i = 0; i < this.#children.length; i++) {
      runSafely(() => this.#children[i].unmount(skipDOM), info);
    }
    this.#children.length = 0;
  }

  #update(content: any) {
    if (!this.isMounted() || !this.#root) return;

    // Fast path: a primitive, or an array of primitives, replacing the same
    // number of text nodes only needs their text updated.
    const children = this.#children;
    const count = children.length;
    const list = isArray(content);
    if (
      count > 0 &&
      (list ? content.length === count && content.every(isPrimitive) : count === 1 && isPrimitive(content)) &&
      children.every(isTextNode)
    ) {
      for (let i = 0; i < count; i++) {
        (children[i].getRoot() as Text).nodeValue = String(list ? content[i] : content);
      }
      return;
    }

    this.#cleanup(false);

    if (content == null || content === false) return;

    const nodes = toMarkupNodes(this.#context, content);

    const parent = this.#root.parentNode as MountTarget | null;
    if (!parent) return;
    let referenceNode: Node = this.#root;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      node.mount(parent, referenceNode);
      this.#children.push(node);

      referenceNode = node.getLastNode() ?? referenceNode;
    }
  }
}

function isPrimitive(value: unknown): boolean {
  return typeof value === "string" || typeof value === "number";
}

function isTextNode(node: MarkupNode): boolean {
  return node instanceof DOMNode && node.getRoot()?.nodeType === Node.TEXT_NODE;
}
