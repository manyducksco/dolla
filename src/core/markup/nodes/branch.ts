import type { Renderable } from "../../../types.js";
import type { Context } from "../../context.js";
import { type Getter, peek, subscribe } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { flushPendingUpdates, runUpdate, scheduleUpdate, type UpdateMeta } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, moveAfter, render } from "../utils.js";

type BranchConfig = {
  key: unknown;
  content: Renderable;
};

export type BranchEntry = readonly [key: unknown, content: Renderable];

/**
 * Renders one of several branches based on a reactive selector.
 *
 * Only the active branch is mounted. Switching branches unmounts the previous
 * branch and builds the next one, so branch content starts fresh every time.
 */
export class BranchNode extends MarkupNode {
  #context: Context;
  #selector: Getter<unknown>;
  #branches: BranchConfig[];
  #fallback?: BranchConfig;

  #anchor: Text | null = null;
  #active: BranchConfig | null = null;
  #node?: MarkupNode;
  #mounted = false;
  #unsubscribe?: () => void;
  readonly #meta: UpdateMeta;

  constructor(context: Context, selector: Getter<unknown>, branches: readonly BranchEntry[], fallback?: Renderable) {
    super();
    this.#context = context;
    this.#selector = selector;
    this.#branches = branches.map(([key, content]) => ({ key, content }));
    this.#meta = { label: "BranchNode", context };
    if (fallback !== undefined) {
      this.#fallback = { key: undefined, content: fallback };
    }
  }

  override getRoot() {
    return this.#anchor ?? undefined;
  }

  override isMounted() {
    return this.#mounted && this.#anchor?.parentNode != null;
  }

  override mount(parent: MountTarget, after?: Node | null) {
    if (this.#mounted) return;

    if (!this.#anchor) this.#anchor = createTextNode("");
    this.#mounted = true;
    addChild(parent, this.#anchor, after);

    let initial = true;
    let hasInitial = false;
    this.#unsubscribe = subscribe(
      this.#selector,
      () => {
        if (initial) {
          hasInitial = true;
          return;
        }
        this.#onChange();
      },
      {
        name: "branch:selector",
        context: this.#context,
      },
    );
    initial = false;
    // Sync the initial branch after the subscription is registered so the
    // node can be safely torn down from inside its own content.
    if (hasInitial) runUpdate(this.#sync, this.#meta);
    flushPendingUpdates();
  }

  override unmount(skipDOM = false) {
    if (!this.#mounted && !this.#anchor) return;

    this.#mounted = false;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    if (!skipDOM) {
      this.#anchor?.parentNode?.removeChild(this.#anchor);
      this.#anchor = null;
    }

    runSafely(() => this.#node?.unmount(skipDOM), {
      phase: "unmount",
      context: this.#context,
    });
    this.#node = undefined;
    this.#active = null;
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;
    moveAfter(parent, this.#anchor, after);
    this.#node?.move(parent, this.#anchor);
  }

  #onChange = () => {
    scheduleUpdate(this.#sync, this.#meta);
  };

  #sync = () => {
    if (!this.#mounted || !this.#anchor) return;

    const branch = this.#findBranch(peek(this.#selector));
    if (branch === this.#active) return;

    runSafely(() => this.#node?.unmount(), {
      phase: "unmount",
      context: this.#context,
    });
    this.#node = undefined;

    // Key by the branch config rather than its selector value so fallback and
    // case values that are both `undefined` cannot collide.
    this.#active = branch;
    if (!branch || branch.content == null || branch.content === false) return;

    const parent = this.#anchor.parentNode as MountTarget | null;
    if (!parent) return;

    const node = render(branch.content, this.#context);
    node.mount(parent, this.#anchor);
    this.#node = node;
  };

  #findBranch(key: unknown): BranchConfig | null {
    for (const branch of this.#branches) {
      if (branch.key === key) return branch;
    }
    return this.#fallback ?? null;
  }
}
