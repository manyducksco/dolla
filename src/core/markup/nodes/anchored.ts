import type { Context } from "../../context.js";
import { type Getter, subscribe, withoutOwner } from "../../signals.js";
import { flushPendingUpdates, runUpdate, scheduleUpdate, type UpdateMeta } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter } from "../utils.js";

/**
 * Base for nodes that render the latest value of a getter after an empty text
 * anchor. Subclasses render values in `update` and remove what they rendered in
 * `clear`.
 */
export abstract class AnchoredNode<T> extends MarkupNode {
  protected readonly context: Context;

  #anchor: Text | null = null;
  #source: Getter<T>;
  #name: string;
  #meta: UpdateMeta;
  #latest!: T;
  #unsubscribe?: () => void;

  /**
   * @param label - Names this node's updates in errors and flush statistics.
   * @param name - Debug name of the subscription to `source`.
   */
  constructor(context: Context, source: Getter<T>, label: string, name: string) {
    super();
    this.context = context;
    this.#source = source;
    this.#name = name;
    this.#meta = { label, context };
  }

  // A stable function, so several changes before a flush cause one update.
  #run = () => {
    if (this.isMounted()) this.update(this.#latest);
  };

  /** The anchor that rendered content follows, while mounted. */
  protected get anchor(): Text | null {
    return this.#anchor;
  }

  override getRoot() {
    return this.#anchor ?? undefined;
  }

  override isMounted() {
    return this.#anchor?.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node | null) {
    if (this.isMounted()) return;

    this.#anchor = createTextNode("");
    addChild(parent, this.#anchor, after);

    let initial = true;
    let hasInitial = false;
    this.#unsubscribe = withoutOwner(() =>
      subscribe(
        this.#source,
        (value) => {
          this.#latest = value;
          if (initial) hasInitial = true;
          else scheduleUpdate(this.#run, this.#meta);
        },
        { name: this.#name, context: this.context },
      ),
    );
    initial = false;
    // Apply the initial value after the subscription is registered so the
    // node can be safely torn down from inside its own content.
    if (hasInitial) runUpdate(this.#run, this.#meta);
    flushPendingUpdates();
  }

  override unmount(skipDOM = false) {
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    if (!skipDOM) this.#anchor?.parentNode?.removeChild(this.#anchor);
    // Clear content even if something else already detached the anchor.
    this.clear(skipDOM);
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;
    moveAfter(parent, this.#anchor, after);
    this.moveContent(parent, this.#anchor);
  }

  /** Renders `value` after the anchor, replacing what was rendered before. */
  protected abstract update(value: T): void;

  /** Unmounts everything this node rendered. */
  protected abstract clear(skipDOM: boolean): void;

  /** Moves the rendered content so it directly follows `anchor`. */
  protected abstract moveContent(parent: MountTarget, anchor: Node): void;
}
