import type { Renderable, View } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import { Context, LifecycleEvent } from "../context.js";
import { render } from "../markup.js";
import { RoutePreloadFn, ROUTER_PRELOAD_CONTROLLER, RouteTransitions } from "../router.js";
import { setCurrentContext, untracked } from "../signal.js";
import { MarkupNode } from "./_markup.js";

export const VIEW = Symbol("ViewNode");
export const VIEW_PRELOAD_CALLBACK = Symbol();
export const VIEW_TRANSITIONS_CONFIG = Symbol();

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
  readonly id = getUniqueId();
  readonly props: P;
  readonly context: Context;
  readonly view: View<P>;

  viewContent?: Renderable;
  node?: MarkupNode;

  initialized = false;

  /**
   * @param context - Parent contenxt to link to.
   * @param view - View function to mount.
   * @param props - Props to pass to view function.
   */
  constructor(context: Context, view: View<P>, props: P) {
    super();
    this.context = Context.createChildOf(context, view.name ?? "anonymous view", {
      logger: {
        tag: this.id,
        tagName: "uid",
      },
    });
    this.context.setState(VIEW, this);
    this.props = props;
    this.view = view;
  }

  getRoot() {
    return this.node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted;
  }

  _init() {
    if (this.initialized) return;

    const { context, view, props } = this;
    const prevCtx = setCurrentContext(context);
    try {
      this.viewContent = view(props);
    } catch (error) {
      context.logger.error(error);
      if (error instanceof Error) {
        context.logger.crash(error as Error);
      }
    } finally {
      setCurrentContext(prevCtx);
      this.initialized = true;
    }
  }

  async _routePreload() {
    this._init();

    // Callback should have been set via $preload hook.
    const callback = this.context.getState<RoutePreloadFn>(VIEW_PRELOAD_CALLBACK, {
      shallow: true,
      fallback: undefined,
    });
    if (!callback) return Promise.resolve();

    console.log("PRELOAD CALLBACK FOUND");

    await callback({});
  }

  _routeTransitionIn(): Promise<void> {
    const config = this.context.getState<RouteTransitions>(VIEW_TRANSITIONS_CONFIG, {
      shallow: true,
      fallback: undefined,
    });
    if (!config?.in) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("TRANSITION IN FOUND");
      resolve();
    });
  }

  _routeTransitionOut(): Promise<void> {
    const config = this.context.getState<any>(VIEW_TRANSITIONS_CONFIG, { shallow: true, fallback: undefined });
    if (!config?.out) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("TRANSITION OUT FOUND");
      resolve();
    });
  }

  mount(parent: Element, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasMounted = this.isMounted();

    if (!wasMounted) {
      this._init();

      if (this.viewContent != null && this.viewContent !== false) {
        this.node = render(this.viewContent, this.context);
      }

      Context.emit(this.context, LifecycleEvent.WILL_MOUNT);
    }

    if (this.node) {
      this.node.mount(parent, after);
    }

    if (!wasMounted) Context.emit(this.context, LifecycleEvent.DID_MOUNT);
  }

  unmount(skipDOM = false) {
    Context.emit(this.context, LifecycleEvent.WILL_UNMOUNT);

    if (this.node) {
      this.node.unmount(skipDOM);
    }

    Context.emit(this.context, LifecycleEvent.DID_UNMOUNT);
    Context.emit(this.context, LifecycleEvent.DISPOSE);
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
