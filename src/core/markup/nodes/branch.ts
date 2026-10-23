import type { Renderable } from "../../../types.js";
import { createContext, type Context } from "../../context.js";
import { type Getter, peek, subscribe } from "../../signals.js";
import { SUSPEND_SCOPE, SuspendScope } from "../../suspend.js";
import { flushPendingUpdates, scheduleUpdate } from "../scheduler.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { addChild, createTextNode, isKeepAlive, moveAfter, render } from "../utils.js";

type Side = "truthy" | "falsy";

type SideConfig = {
  content: Renderable;
  keepAlive: boolean;
};

const SIDES: Side[] = ["truthy", "falsy"];

function normalizeSide(value: Renderable): SideConfig {
  if (isKeepAlive(value)) {
    return { content: value.content, keepAlive: true };
  }
  return { content: value, keepAlive: false };
}

/**
 * Renders one of two sides based on a reactive condition.
 *
 * Unlike `DynamicNode`, a side wrapped in `keepAlive()` is suspended instead of
 * unmounted when hidden. Suspended sides keep their signals, contexts, DOM,
 * refs, and effects alive; only their DOM is detached.
 */
export class BranchNode extends MarkupNode {
  #context: Context;
  #condition: Getter<any>;
  #sides: Record<Side, SideConfig>;
  #nodes: Partial<Record<Side, MarkupNode>> = {};
  #scopes: Partial<Record<Side, SuspendScope>> = {};
  #parking: DocumentFragment | null = null;
  #anchor: Text | null = null;
  #active: Side | null = null;
  #mounted = false;
  #suspended = false;
  #ancestorScope?: SuspendScope;
  #unsubscribe?: () => void;

  constructor(context: Context, condition: Getter<any>, whenTruthy?: Renderable, whenFalsy?: Renderable) {
    super();
    this.#context = context;
    this.#condition = condition;
    this.#sides = {
      truthy: normalizeSide(whenTruthy),
      falsy: normalizeSide(whenFalsy),
    };
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
    // nested branch created inside a suspended tree starts suspended.
    this.#ancestorScope = (this.#context as any)[SUSPEND_SCOPE] as SuspendScope | undefined;
    this.#ancestorScope?.addResource(this);

    this.#unsubscribe = subscribe(this.#condition, this.#onChange);
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

    for (const side of SIDES) {
      const node = this.#nodes[side];
      if (!node) continue;

      // Parked sides live in a separate fragment, so they must be removed
      // explicitly even when the active side can skip DOM work.
      const isParked = side !== this.#active;
      node.unmount(skipDOM && !isParked);
      this.#nodes[side] = undefined;
    }

    this.#parking = null;
    this.#active = null;
    this.#suspended = false;
    this.#scopes = {};
  }

  override move(parent: MountTarget, after?: Node | null) {
    if (!this.#anchor) return;
    moveAfter(parent, this.#anchor, after);
    if (this.#active) {
      this.#nodes[this.#active]?.move(parent, this.#anchor);
    }
  }

  /**
   * Called by an outer keep-alive scope. Only the active side is affected;
   * parked sides are already suspended.
   */
  suspend() {
    if (!this.#mounted || this.#suspended) return;
    this.#suspended = true;

    const active = this.#active;
    if (active && this.#sides[active].keepAlive) {
      this.#scopes[active]?.suspend();
    }
  }

  /**
   * Called by an outer keep-alive scope.
   */
  resume() {
    if (!this.#mounted || !this.#suspended) return;
    this.#suspended = false;

    const active = this.#active;
    if (active && this.#sides[active].keepAlive) {
      this.#scopes[active]?.resume();
    }
  }

  #onChange = () => {
    scheduleUpdate(this.#sync);
  };

  #sync = () => {
    if (!this.#mounted || !this.#anchor) return;

    const next: Side = peek(this.#condition) ? "truthy" : "falsy";
    if (next === this.#active) return;

    const previous = this.#active;
    this.#active = next;

    if (previous) this.#deactivate(previous);
    this.#activate(next);
  };

  #activate(side: Side) {
    const anchor = this.#anchor;
    const parent = anchor?.parentNode as MountTarget | null;
    if (!anchor || !parent) return;

    const config = this.#sides[side];
    const { content } = config;

    if (content == null || content === false) return;

    const existing = this.#nodes[side];
    if (existing) {
      existing.move(parent, anchor);
      if (config.keepAlive && !this.#suspended) {
        this.#scopes[side]?.resume();
      }
      return;
    }

    let context = this.#context;

    if (config.keepAlive) {
      const scope = new SuspendScope();
      this.#scopes[side] = scope;
      context = createContext(this.#context, { [SUSPEND_SCOPE]: scope } as any);

      // Suspend before rendering so portals/hooks created during mount see an
      // already-suspended scope.
      if (this.#suspended) scope.suspend();
    }

    const node = render(content, context);
    this.#nodes[side] = node;
    node.mount(parent, anchor);
  }

  #deactivate(side: Side) {
    const node = this.#nodes[side];
    if (!node) return;

    if (this.#sides[side].keepAlive) {
      this.#scopes[side]?.suspend();
      node.move(this.#getParking());
    } else {
      node.unmount();
      this.#nodes[side] = undefined;
    }
  }

  #getParking() {
    return (this.#parking ??= document.createDocumentFragment());
  }
}
