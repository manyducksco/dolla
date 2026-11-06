import type { View } from "../../../types.js";
import { createContext, mountContext, cleanupContext, isMounted, type Context } from "../../context.js";
import { peek, withoutOwner } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { pushContext, popContext } from "../../signal-debug.js";
import { MarkupNode } from "../types.js";
import { createTextNode, render } from "../utils.js";
import { DOMNode } from "./dom.js";
export const VIEW = Symbol.for("$_VIEW_NODE");

type InstanceHook = (view: View<any>, node: ViewNode<any>) => void;

// Installed by the HMR runtime (`hmr.ts`) when it loads. Production builds never
// load it, so mounting a view does no tracking work and pulls in no HMR code.
let onInstanceMount: InstanceHook | undefined;
let onInstanceUnmount: InstanceHook | undefined;

/**
 * Registers callbacks for every view instance that mounts or unmounts, so the
 * HMR runtime can find the instances of a view to replace.
 */
export function trackViewInstances(mount: InstanceHook, unmount: InstanceHook): void {
  onInstanceMount = mount;
  onInstanceUnmount = unmount;
}

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  // Internal. Read and written by the HMR runtime's `replaceView`, which lives in
  // `hmr.ts` so production builds don't carry it. Not part of the public API.
  readonly _props: P;
  _view: View<P>;
  _node?: MarkupNode;

  readonly context: Context;

  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = createContext(context, {
      [VIEW]: this,
      name: view.name,
    });
    this._props = props;
    this._view = view;
  }

  getRoot() {
    return this._node?.getRoot();
  }

  getLastNode() {
    return this._node?.getLastNode();
  }

  isMounted() {
    return isMounted(this.context);
  }

  mount(parent: Element, after?: Node | null) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      pushContext(this.context);
      try {
        this._node = this._render();
      } finally {
        popContext();
      }

      onInstanceMount?.(this._view, this);
    }

    this._node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  /** Runs the view function and returns a node for what it rendered. Internal. */
  _render(): MarkupNode {
    const content = withoutOwner(() =>
      // The view's context owns its effects, not a surrounding effect.
      peek(() => this._view.call(this.context, this._props, this.context)),
    );
    return content != null && content !== false
      ? render(content, this.context)
      : new DOMNode(this.context, createTextNode(""));
  }

  unmount(skipDOM = false) {
    runSafely(() => this._node?.unmount(skipDOM), {
      phase: "unmount",
      context: this.context,
    });
    cleanupContext(this.context);
    onInstanceUnmount?.(this._view, this);
  }

  move(parent: Element, after?: Node | null) {
    this._node?.move(parent, after);
  }
}
