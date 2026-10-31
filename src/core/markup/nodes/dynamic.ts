import type { Context } from "../../context.js";
import type { Getter } from "../../signals.js";
import { runSafely } from "../../errors.js";
import type { MarkupNode, MountTarget } from "../types.js";
import { render } from "../utils.js";
import { AnchoredNode } from "./anchored.js";
import { DOMNode } from "./dom.js";

/**
 * Renders any kind of content; markup, signals, DOM nodes, etc.
 * If it can be rendered by Dolla then Dynamic will do it.
 */
export class DynamicNode extends AnchoredNode<any> {
  #node?: MarkupNode;

  constructor(context: Context, slot: Getter<any>) {
    super(context, slot, "DynamicNode", "dynamic");
  }

  override getLastNode() {
    return this.#node?.getLastNode() ?? this.getRoot();
  }

  protected override update(content: any) {
    // Fast path: replacing text with text only needs the text updated.
    const node = this.#node;
    if ((typeof content === "string" || typeof content === "number") && node instanceof DOMNode) {
      const root = node.getRoot();
      if (root.nodeType === Node.TEXT_NODE) {
        root.nodeValue = String(content);
        return;
      }
    }

    this.clear(false);

    if (content == null || content === false) return;

    const parent = this.anchor!.parentNode as MountTarget | null;
    if (!parent) return;

    this.#node = render(content, this.context);
    this.#node.mount(parent, this.anchor);
  }

  protected override clear(skipDOM: boolean) {
    const node = this.#node;
    this.#node = undefined;
    if (node) runSafely(() => node.unmount(skipDOM), { phase: "unmount", context: this.context });
  }

  protected override moveContent(parent: MountTarget, anchor: Node) {
    this.#node?.move(parent, anchor);
  }
}
