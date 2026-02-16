import type { Renderable, View } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import { Context, LifecycleEvent } from "../context.js";
import { render } from "../markup.js";
import { ROUTER_PRELOAD_CONTROLLER } from "../router.js";
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
  readonly viewContent: Renderable;

  node?: MarkupNode;

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

    // TODO: Handle $preload with router

    const prevCtx = setCurrentContext(context);
    try {
      this.viewContent = view(props);
    } catch (error) {
      context.logger.error(error);
      if (error instanceof Error) {
        context.logger.crash(error as Error);
      }
      return;
    } finally {
      setCurrentContext(prevCtx);
    }
  }

  getRoot() {
    return this.node?.getRoot();
  }

  isMounted() {
    return this.context.isMounted;
  }

  _routePreload(): Promise<void> {
    // Callback should have been set via $preload hook.
    const callback = this.context.getState(VIEW_PRELOAD_CALLBACK, { shallow: true });
    if (!callback) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("PRELOAD CALLBACK FOUND");
      resolve();
    });
  }

  _routeTransitionIn(): Promise<void> {
    const callback = this.context.getState<any>(VIEW_TRANSITIONS_CONFIG, { shallow: true })?.in;
    if (!callback) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("TRANSITION IN FOUND");
      resolve();
    });
  }

  _routeTransitionOut(): Promise<void> {
    const callback = this.context.getState<any>(VIEW_TRANSITIONS_CONFIG, { shallow: true })?.out;
    if (!callback) return Promise.resolve();

    return new Promise((resolve, reject) => {
      console.log("TRANSITION OUT FOUND");
      resolve();
    });
  }

  mount(parent: Element, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasMounted = this.isMounted();

    // TODO: Look into own state and find route controller.
    // If preload function exists, pass the route controller to it.
    // If no preload function exists, just call .next() on the route.
    // Preload function is added by useRoutePreload hook.

    // One problem is mounting and unmounting is entirely synchronous, but we need async and suspense.
    // While a view is in suspense, the nearest suspense boundary shows fallback content.
    // Routes are a suspense boundary of a sort where they don't unmount the previous view until the next leaves suspense.

    if (!wasMounted) {
      // const { context, props, view } = this;
      // try {
      //   const prevCtx = setCurrentContext(context);
      //   const result = view(props);
      //   setCurrentContext(prevCtx);
      //   if (result != null && result !== false) {
      //     this.node = render(result, context);
      //   }
      // } catch (error) {
      //   context.logger.error(error);
      //   if (error instanceof Error) {
      //     context.logger.crash(error as Error);
      //   }
      //   return;
      // }

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
