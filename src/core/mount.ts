import { MOUNT, Router, UNMOUNT } from "../router/router";
import { assertInstanceOf } from "../typeChecking";
import type { View } from "../types";
import { Context } from "./context";
import { type LoggerErrorProps, onLoggerCrash } from "./logger";
import { type MarkupNode } from "./markup";
import { ViewInstance } from "./nodes/view";
import { DefaultCrashView } from "./views/default-crash-view";

let isMounted = false;

export type UnmountFn = () => Promise<void>;
export interface MountOptions {
  crashView?: View<LoggerErrorProps>;

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

  onLoggerCrash((props) => {
    if (isMounted) {
      unmount();
    }

    // Mount the crash page
    new ViewInstance(rootContext, crashView, props).mount(rootElement);
  });

  Context.willMount(rootContext);

  if (view instanceof Router) {
    router = view;
    rootView = await router[MOUNT](rootElement, rootContext);
  } else {
    // First, initialize the root view. The router store needs this to connect the initial route.
    rootView = new ViewInstance(rootContext, view, {});
  }

  rootView.mount(rootElement);
  isMounted = true;

  Context.didMount(rootContext);

  async function unmount() {
    if (!isMounted) return;

    Context.willUnmount(rootContext);

    rootView.unmount(false);

    if (router) {
      await router[UNMOUNT]();
    }

    isMounted = false;

    Context.didUnmount(rootContext);
  }

  return unmount;
}
