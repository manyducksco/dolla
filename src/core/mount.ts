import { MOUNT, Router, UNMOUNT } from "../router/router";
import { assertInstanceOf } from "../typeChecking";
import type { View } from "../types";
import { Context, LifecycleEvent } from "./context";
import { type LoggerErrorContext, onLoggerCrash } from "./logger";
import { m, type MarkupNode, render } from "./markup";
import { DefaultCrashView } from "./views/default-crash-view";

let isMounted = false;

export type UnmountFn = () => Promise<void>;
export interface MountOptions {
  crashView?: View<LoggerErrorContext>;

  /**
   * An existing Context to use as the root, otherwise a new one will be created.
   * Use this to provide top-level stores and state to the whole app.
   */
  context?: Context;
}

export async function mount(view: View<{}>, domNode: Element, options?: MountOptions): Promise<UnmountFn>;
export async function mount(router: Router, domNode: Element, options?: MountOptions): Promise<UnmountFn>;

export async function mount(view: any, rootElement: Element, options?: MountOptions): Promise<UnmountFn> {
  assertInstanceOf(Element, rootElement, "Expected an element or a selector string. Got type: %t, value: %v");

  if (isMounted) {
    throw new Error(`A Dolla app is already mounted.`);
  }

  let rootView: MarkupNode;
  let router: Router | undefined;
  let crashView = options?.crashView ?? DefaultCrashView;

  const rootContext = options?.context ?? new Context("App");

  onLoggerCrash((ctx) => {
    if (isMounted) {
      unmount();
    }

    // Mount the crash page
    render(m(crashView, ctx), rootContext).mount(rootElement);
  });

  Context.emit(LifecycleEvent.WILL_MOUNT, rootContext);

  if (view instanceof Router) {
    router = view;
    rootView = await router[MOUNT](rootElement, rootContext);
  } else {
    // First, initialize the root view. The router store needs this to connect the initial route.
    rootView = render(m(view), rootContext);
  }

  rootView.mount(rootElement);
  isMounted = true;

  Context.emit(LifecycleEvent.DID_MOUNT, rootContext);

  async function unmount() {
    if (!isMounted) return;

    Context.emit(LifecycleEvent.WILL_UNMOUNT, rootContext);

    rootView.unmount(false);

    if (router) {
      await router[UNMOUNT]();
    }

    isMounted = false;

    Context.emit(LifecycleEvent.DID_UNMOUNT, rootContext);
  }

  return unmount;
}
