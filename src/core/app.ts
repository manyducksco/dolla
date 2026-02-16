import { isFunction, isObject, typeOf } from "../typeChecking.js";
import type { View } from "../types";
import { Context, LifecycleEvent } from "./context.js";
import { createI18n, I18N, type I18n, I18nHandle, type I18nOptions } from "./i18n.js";
import { LoggerCrashProps, onLoggerCrash } from "./logger.js";
import { ViewNode } from "./nodes/view.js";
import { Route, ROUTER, Router, RouterOptions } from "./router.js";
import { DefaultCrashView } from "./views/default-crash-view.js";
import { Fragment } from "./views/fragment.js";

export interface DollaOptions extends Partial<RouterOptions> {
  /**
   * Main view to mount in the app. Used unless `routes` is defined.
   */
  view?: View<{}>;

  /**
   * View to show when a $debug crash is invoked. Takes information about the crash.
   */
  crashView?: View<LoggerCrashProps>;

  /**
   * Options for language translations.
   */
  i18n?: I18nOptions;
}

export interface DollaOptionsWithView extends DollaOptions {
  view: View<{}>;
}

export interface DollaOptionsWithRoutes extends DollaOptions {
  routes: Route[];
}

class App {
  #context: Context;
  #mounted = false;
  #crashView: View<LoggerCrashProps> = DefaultCrashView;

  #cleanup: (() => void)[] = [];

  #router;
  #i18n: I18nHandle;

  readonly router;
  readonly i18n: I18n;

  constructor(options: DollaOptions) {
    this.#context = new Context("App");

    if (options.crashView) {
      this.#crashView = options.crashView;
    }

    this.#router = new Router(this.#context, {
      hash: options.hash ?? false,
      routes: options.routes ?? [{ path: "*", view: options.view ?? Fragment }],
    });
    this.router = this.#router.api();
    this.#context.setState(ROUTER, this.router);

    const i18n = createI18n({
      locale: options.i18n?.locale ?? "auto",
      translations: options.i18n?.translations ?? [],
      ...options.i18n,
    });
    this.#i18n = i18n.handle;
    this.i18n = i18n.exports;
    this.#context.setState(I18N, i18n.exports);
  }

  async mount(element: string | Element): Promise<void> {
    if (this.#mounted) return Promise.resolve();

    const parentElement = this.#getElement(element);

    this.#cleanup.push(
      onLoggerCrash((props) => {
        if (this.#mounted) {
          this.unmount().then(() => {
            new ViewNode(this.#context, this.#crashView, props).mount(parentElement);
          });
        } else {
          new ViewNode(this.#context, this.#crashView, props).mount(parentElement);
        }
      }),
    );

    Context.emit(this.#context, LifecycleEvent.WILL_MOUNT);

    await this.#i18n.mount();
    await this.#router.mount(parentElement);

    this.#mounted = true;

    Context.emit(this.#context, LifecycleEvent.DID_MOUNT);
  }

  async unmount() {
    if (!this.#mounted) return Promise.resolve();

    Context.emit(this.#context, LifecycleEvent.WILL_UNMOUNT);
    this.#mounted = false;

    this.#router.unmount();
    this.#i18n.unmount();

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

export function dolla(view: View<{}>): App;
export function dolla(options: DollaOptionsWithView): App;
export function dolla(options: DollaOptionsWithRoutes): App;

export function dolla(init: View<{}> | DollaOptionsWithView | DollaOptionsWithRoutes) {
  if (isFunction<View<{}>>(init)) {
    return new App({ view: init });
  } else if (isObject<DollaOptions>(init)) {
    return new App(init);
  } else {
    throw new Error(`Expected a view function or options object. Got: ${typeOf(init)}`);
  }
}
