import { createRouter } from "../router";
import { MOUNT, ROUTER, Router, RouterOptions, UNMOUNT } from "../router/router";
import { typeOf } from "../typeChecking";
import { View } from "../types";
import { Context, LifecycleEvent } from "./context";
import { LoggerCrashProps, onLoggerCrash } from "./logger";
import { MarkupNode } from "./markup";
import { ViewNode } from "./nodes/view";
import { DefaultCrashView } from "./views/default-crash-view";
import { Fragment } from "./views/fragment";

interface AppOptions {
  view?: View<{}>;
  router?: Router;
  context?: Context;
}

class App {
  #root!: MarkupNode;
  #context: Context;
  #view: View<{}>;
  #router?: Router;
  #mounted = false;
  #crashView: View<LoggerCrashProps> = DefaultCrashView;

  #cleanup: (() => void)[] = [];

  get context() {
    return this.#context;
  }

  constructor(options: AppOptions) {
    this.#view = options.view ?? Fragment;
    this.#router = options.router;
    this.#context = options.context ?? new Context("App");
  }

  setCrashView(view: View<LoggerCrashProps>) {
    this.#crashView = view;
    return this;
  }

  async mount(element: string | Element): Promise<void> {
    if (this.#mounted) return Promise.resolve();

    const parentElement = this.#getElement(element);

    this.#cleanup.push(
      onLoggerCrash((props) => {
        if (this.#mounted) {
          this.unmount();
        }
        new ViewNode(this.#context, this.#crashView, props).mount(parentElement);
      }),
    );

    Context.emit(this.#context, LifecycleEvent.WILL_MOUNT);

    if (this.#router) {
      this.#root = await this.#router[MOUNT](parentElement, this.#context);
      this.#context.setState(ROUTER, this.#router);
    } else {
      this.#root = new ViewNode(this.#context, this.#view, {});
    }
    this.#root.mount(parentElement);
    this.#mounted = true;

    Context.emit(this.#context, LifecycleEvent.DID_MOUNT);
  }

  async unmount() {
    if (!this.#mounted) return Promise.resolve();

    Context.emit(this.#context, LifecycleEvent.WILL_UNMOUNT);
    this.#mounted = false;

    this.#root.unmount(false);
    if (this.#router) {
      await this.#router[UNMOUNT]();
    }

    for (const callback of this.#cleanup) {
      callback();
    }
    this.#cleanup = [];

    Context.emit(this.#context, LifecycleEvent.DID_UNMOUNT);
  }

  #getElement(element: string | Element): Element {
    if (typeof element === "string") {
      const match = document.querySelector(element);
      if (!match) {
        throw new Error(`Selector '${element}' did not many any element.`);
      }
      return match;
    } else if (element instanceof Element) {
      return element;
    } else {
      throw new Error("Expected a selector string or DOM element.");
    }
  }
}

export interface CreateAppOptions {
  context?: Context;
}

export function createApp(view: View<{}>, options?: CreateAppOptions): App;
export function createApp(routerOptions: RouterOptions, options?: CreateAppOptions): App;
export function createApp(router: Router, options?: CreateAppOptions): App;

export function createApp(entry: View<{}> | RouterOptions | Router, options?: CreateAppOptions) {
  if (entry instanceof Router) {
    return new App({ ...options, router: entry });
  } else if (typeOf(entry) === "object") {
    return new App({ ...options, router: createRouter(entry as RouterOptions) });
  } else {
    return new App({ ...options, view: entry as View<{}> });
  }
}
