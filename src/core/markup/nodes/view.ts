import type { View } from "../../../types.js";
import { createContext, mountContext, cleanupContext, REPLACING, isMounted, type Context } from "../../context.js";
import { peek, withoutOwner } from "../../signals.js";
import { runSafely } from "../../errors.js";
import { pushContext, popContext } from "../../signal-debug.js";
import { MarkupNode, type MountTarget } from "../types.js";
import { createTextNode, render } from "../utils.js";
import { DOMNode } from "./dom.js";
import { registerViewInstance, unregisterViewInstance } from "../../hmr.js";

export const VIEW = Symbol.for("$_VIEW_NODE");

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly #props: P;
  #view: View<P>;
  #node?: MarkupNode;

  readonly context: Context;

  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = createContext(context, {
      [VIEW]: this,
      name: view.name,
    });
    this.#props = props;
    this.#view = view;
  }

  getRoot() {
    return this.#node?.getRoot();
  }

  getLastNode() {
    return this.#node?.getLastNode();
  }

  isMounted() {
    return isMounted(this.context);
  }

  mount(parent: Element, after?: Node | null) {
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      pushContext(this.context);
      this.#node = this.#render();
      popContext();

      registerViewInstance(this.#view, this);
    }

    this.#node!.mount(parent, after);

    if (!wasMounted) mountContext(this.context);
  }

  /** Runs the view function and returns a node for what it rendered. */
  #render(): MarkupNode {
    const content = withoutOwner(() =>
      // The view's context owns its effects, not a surrounding effect.
      peek(() => this.#view.call(this.context, this.#props, this.context)),
    );
    return content != null && content !== false
      ? render(content, this.context)
      : new DOMNode(this.context, createTextNode(""));
  }

  unmount(skipDOM = false) {
    runSafely(() => this.#node?.unmount(skipDOM), {
      phase: "unmount",
      context: this.context,
    });
    cleanupContext(this.context);
    unregisterViewInstance(this.#view, this);
  }

  move(parent: Element, after?: Node | null) {
    this.#node?.move(parent, after);
  }

  /**
   * Used for hot reload.
   */
  replaceView(newView: View<P>) {
    const wasMounted = this.isMounted();
    if (!wasMounted) {
      unregisterViewInstance(this.#view, this);
      this.#view = newView;
      this.context.name = newView.name;
      registerViewInstance(this.#view, this);
      return;
    }

    const oldRoot = this.#node?.getRoot();
    const parent = oldRoot?.parentNode as MountTarget | undefined;
    const after = oldRoot?.previousSibling;

    runSafely(() => this.#node?.unmount(), {
      phase: "unmount",
      context: this.context,
    });

    if (oldRoot && oldRoot.parentNode) {
      oldRoot.parentNode.removeChild(oldRoot);
    }

    cleanupContext(this.context);
    unregisterViewInstance(this.#view, this);

    this.#view = newView;
    this.context.name = newView.name;

    try {
      this.context[REPLACING] = true;
      pushContext(this.context);
      this.#node = this.#render();

      registerViewInstance(newView, this);

      if (parent) {
        this.#node.mount(parent, after);
      }

      mountContext(this.context);
    } catch (e) {
      registerViewInstance(newView, this);
      try {
        this.#node = new DOMNode(this.context, createTextNode(""));
        if (parent) {
          this.#node.mount(parent, after);
        }
        mountContext(this.context);
      } catch {
        // Node stays unmounted; next HMR cycle will handle it.
      }
      throw e;
    } finally {
      this.context[REPLACING] = false;
      popContext();
    }
  }
}
