import type { Renderable, View } from "../../types.js";
import { Context, LifecycleEvent, performInContext } from "../context.js";
import { render } from "../markup.js";
import { RoutePreloadFn, RouteTransitions } from "../router.js";
import { MarkupNode } from "./_markup.js";

export const VIEW = Symbol("ViewNode");
export const VIEW_PRELOAD_CALLBACK = Symbol();
export const VIEW_TRANSITIONS_CONFIG = Symbol();

/**
 * Renders a View.
 */
export class ViewNode<P> extends MarkupNode {
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
    this.context = context.createChild(view.name);
    this.context.setState(VIEW, this);
    this.props = props;
    this.view = view;
  }

  getRoot() {
    return this.node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted();
  }

  #init() {
    if (this.initialized) return;

    const { context, view, props } = this;

    try {
      performInContext(context, () => {
        this.viewContent = view(props);
      });
      this.initialized = true;
    } catch (error) {
      this.context.throwError(error);
    }
  }

  async _routePreload() {
    this.#init();

    // Callback should have been set via $preload hook.
    const callback = this.context.getOwnState<RoutePreloadFn>(VIEW_PRELOAD_CALLBACK);
    if (!callback) return Promise.resolve();

    console.log("PRELOAD CALLBACK FOUND");

    await callback({});
  }

  _routeTransitionIn(): Promise<void> {
    const config = this.context.getOwnState<RouteTransitions>(VIEW_TRANSITIONS_CONFIG);
    if (!config?.in) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("TRANSITION IN FOUND");
      resolve();
    });
  }

  _routeTransitionOut(): Promise<void> {
    const config = this.context.getOwnState<any>(VIEW_TRANSITIONS_CONFIG);
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
      this.#init();

      if (this.viewContent != null && this.viewContent !== false) {
        this.node = render(this.viewContent, this.context);
      }

      this.context.emit(LifecycleEvent.WILL_MOUNT);
    }

    if (this.node) {
      this.node.mount(parent, after);
    }

    // TODO: Handle transition in

    if (!wasMounted) this.context.emit(LifecycleEvent.DID_MOUNT);
  }

  unmount(skipDOM = false) {
    this.context.emit(LifecycleEvent.WILL_UNMOUNT);

    // TODO: Handle transition out

    if (this.node) {
      this.node.unmount(skipDOM);
    }

    this.context.emit(LifecycleEvent.DID_UNMOUNT);
    this.context.emit(LifecycleEvent.DISPOSE);
  }

  move(parent: Element, after?: Node) {
    this.node?.move(parent, after);
  }
}
