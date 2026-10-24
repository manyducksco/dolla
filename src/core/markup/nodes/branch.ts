import type { Renderable } from "../../../types.js";
import { createContext, type Context } from "../../context.js";
import { type Getter, peek, subscribe } from "../../signals.js";
import { VISIBILITY_SCOPE, VisibilityScope } from "../../visibility.js";
import { flushPendingUpdates, scheduleUpdate } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, isKeepAlive, moveAfter, render } from "../utils.js";

type BranchConfig = {
  key: unknown;
  content: Renderable;
  keepAlive: boolean;
};

export type BranchEntry = readonly [key: unknown, content: Renderable];

function normalizeBranch(key: unknown, value: Renderable): BranchConfig {
  if (isKeepAlive(value)) {
    return { key, content: value.content, keepAlive: true };
  }
  return { key, content: value, keepAlive: false };
}

/**
 * Renders one of several branches based on a reactive selector.
 *
 * A branch wrapped in `keepAlive()` is hidden instead of unmounted when it is
 * no longer active. Hidden branches keep their signals, contexts, DOM, refs,
 * and effects alive; only their DOM is detached.
 */
export class BranchNode extends MarkupNode {
  #context: Context;
  #selector: Getter<unknown>;
  #branches: BranchConfig[];
  #fallback?: BranchConfig;
  #nodes = new Map<BranchConfig, MarkupNode>();
  #scopes = new Map<BranchConfig, VisibilityScope>();
  #detachedFragment: DocumentFragment | null = null;
  #anchor: Text | null = null;
  #active: BranchConfig | null = null;
  #mounted = false;
  #hidden = false;
  #ancestorScope?: VisibilityScope;
  #unsubscribe?: () => void;

  constructor(context: Context, selector: Getter<unknown>, branches: readonly BranchEntry[], fallback?: Renderable) {
    super();
    this.#context = context;
    this.#selector = selector;
    this.#branches = branches.map(([key, content]) => normalizeBranch(key, content));
    if (fallback !== undefined) {
      this.#fallback = normalizeBranch(undefined, fallback);
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

    // Register with an outer keep-alive scope before the initial sync so a
    // nested branch created inside a hidden tree starts hidden.
    this.#ancestorScope = (this.#context as any)[VISIBILITY_SCOPE] as VisibilityScope | undefined;
    this.#ancestorScope?.addResource(this);

    this.#unsubscribe = subscribe(this.#selector, this.#onChange);
    flushPendingUpdates();
  }

  override unmount(skipDOM = false) {
    if (!this.#mounted && !this.#anchor) return;

    this.#mounted = false;
    this.#unsubscribe?.();
    this.#unsubscribe = undefined;

    this.#ancestorScope?.deleteResource(this);
    this.#ancestorScope = undefined;

    if (!skipDOM) {
      this.#anchor?.parentNode?.removeChild(this.#anchor);
      this.#anchor = null;
    }

    for (const [branch, node] of this.#nodes) {
      // Hidden branches live in a separate fragment, so they must be removed
      // explicitly even when the active branch can skip DOM work.
      const isHidden = branch !== this.#active;
      node.unmount(skipDOM && !isHidden);
    }

    this.#nodes.clear();
    this.#detachedFragment = null;
    this.#active = null;
    this.#hidden = false;
    this.#scopes.clear();
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;
    moveAfter(parent, this.#anchor, after);
    if (this.#active) {
      this.#nodes.get(this.#active)?.move(parent, this.#anchor);
    }
  }

  /**
   * Called by an outer keep-alive scope. Only the active branch is affected;
   * hidden branches are already hidden.
   */
  hide() {
    if (!this.#mounted || this.#hidden) return;
    this.#hidden = true;

    const active = this.#active;
    if (active?.keepAlive) {
      this.#scopes.get(active)?.hide();
    }
  }

  /**
   * Called by an outer keep-alive scope.
   */
  show() {
    if (!this.#mounted || !this.#hidden) return;
    this.#hidden = false;

    const active = this.#active;
    if (active?.keepAlive) {
      this.#scopes.get(active)?.show();
    }
  }

  #onChange = () => {
    scheduleUpdate(this.#sync);
  };

  #sync = () => {
    if (!this.#mounted || !this.#anchor) return;

    const next = this.#findBranch(peek(this.#selector)) ?? null;
    if (next === this.#active) return;

    const previous = this.#active;
    this.#active = next;

    if (previous) this.#deactivate(previous);
    if (next) this.#activate(next);
  };

  #findBranch(key: unknown) {
    for (const branch of this.#branches) {
      if (branch.key === key) return branch;
    }
    return this.#fallback;
  }

  #activate(branch: BranchConfig) {
    const anchor = this.#anchor;
    const parent = anchor?.parentNode as MountTarget | null;
    if (!anchor || !parent) return;

    const { content } = branch;
    if (content == null || content === false) return;

    const existing = this.#nodes.get(branch);
    if (existing) {
      existing.move(parent, anchor);
      if (branch.keepAlive && !this.#hidden) {
        this.#scopes.get(branch)?.show();
      }
      return;
    }

    let context = this.#context;

    if (branch.keepAlive) {
      const scope = new VisibilityScope();
      this.#scopes.set(branch, scope);
      context = createContext(this.#context, { [VISIBILITY_SCOPE]: scope } as any);

      // Hide before rendering so portals/hooks created during mount see an
      // already-hidden scope.
      if (this.#hidden) scope.hide();
    }

    const node = render(content, context);
    this.#nodes.set(branch, node);
    node.mount(parent, anchor);
  }

  #deactivate(branch: BranchConfig) {
    const node = this.#nodes.get(branch);
    if (!node) return;

    if (branch.keepAlive) {
      this.#scopes.get(branch)?.hide();
      node.move(this.#getDetachedFragment());
    } else {
      node.unmount();
      this.#nodes.delete(branch);
    }
  }

  #getDetachedFragment() {
    return (this.#detachedFragment ??= document.createDocumentFragment());
  }
}
