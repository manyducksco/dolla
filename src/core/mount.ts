import { MOUNT, ROOT_VIEW, UNMOUNT, Router } from "../router/router";
import { assertInstanceOf, isString } from "../typeChecking";
import { rootElementContext } from "./context";
import { type LoggerErrorContext, onLoggerCrash } from "./logger";
import { markup } from "./markup";
import { constructView, type ViewElement, type ViewFunction } from "./nodes/view";
import { DefaultCrashView } from "./views/default-crash-view";

let isMounted = false;

export type UnmountFn = () => Promise<void>;
export interface MountOptions {
  crashView?: ViewFunction<LoggerErrorContext>;
}

export async function mount(parent: Element, view: any, options?: MountOptions): Promise<UnmountFn>;
export async function mount(parent: Element, router: any, options?: MountOptions): Promise<UnmountFn>;

export async function mount(parent: string, view: any, options?: MountOptions): Promise<UnmountFn>;
export async function mount(parent: string, router: any, options?: MountOptions): Promise<UnmountFn>;

export async function mount(target: any, view: any, options?: MountOptions): Promise<UnmountFn> {
  if (isMounted) {
    throw new Error(`A Dolla app is already mounted.`);
  }

  let rootElement: Element;
  let rootView: ViewElement;
  let router: any | undefined;
  let crashView = options?.crashView ?? DefaultCrashView;

  if (isString(target)) {
    const match = document.querySelector<Element>(target);
    assertInstanceOf(Element, match, `Selector '${target}' did not match any element.`);
    rootElement = match!;
  } else {
    assertInstanceOf(Element, target, "Expected an element or a selector string. Got type: %t, value: %v");
    rootElement = target;
  }

  if (view instanceof Router) {
    router = view;
    rootView = view[ROOT_VIEW];
  } else {
    // First, initialize the root view. The router store needs this to connect the initial route.
    const rootViewMarkup = markup(view);
    rootView = constructView(rootViewMarkup.type as ViewFunction<any>, rootViewMarkup.props);
  }

  onLoggerCrash((ctx) => {
    if (isMounted) {
      // Unmount the app.
      unmount();

      // Mount the crash page
      const crashPage = constructView(crashView, ctx);
      crashPage.mount(rootElement!);
    }
  });

  // Run onMount for stores.
  for (const store of rootElementContext.stores.values()) {
    store.handleMount();
  }

  if (router) {
    await router[MOUNT](rootElement);
  }

  rootView.mount(rootElement);
  isMounted = true;

  async function unmount() {
    if (!isMounted) return;

    rootView.unmount(false);

    if (router) {
      await router[UNMOUNT]();
    }

    isMounted = false;
  }

  return unmount;
}
