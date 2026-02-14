import { isFunction, isObject, typeOf } from "../typeChecking";
import { View } from "../types";
import { Context, LifecycleEvent } from "./context";
import { I18N, I18n, I18nOptions } from "./i18n";
import { LoggerCrashProps, onLoggerCrash } from "./logger";
import { ViewNode } from "./nodes/view";
import { Route, ROUTER, Router, RouterOptions } from "./router";
import { DefaultCrashView } from "./views/default-crash-view";
import { Fragment } from "./views/fragment";

export interface DollaOptions extends Partial<RouterOptions> {
  view?: View<{}>;
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

  #router: Router;
  #i18n: I18n;

  readonly router;
  readonly i18n;

  constructor(options: DollaOptions) {
    this.#context = new Context("App");

    this.#router = new Router(this.#context, {
      hash: options.hash ?? false,
      routes: options.routes ?? [{ path: "*", view: options.view ?? Fragment }],
    });
    this.#i18n = new I18n({
      locale: options.i18n?.locale ?? "auto",
      translations: options.i18n?.translations ?? [],
      ...options.i18n,
    });

    this.router = this.#router.api();
    this.i18n = this.#i18n.api();

    this.#context.setState(ROUTER, this.router);
    this.#context.setState(I18N, this.i18n);
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

const app = dolla({
  routes: [
    {
      path: "*",
      view: () => {
        return "hello";
      },
    },
  ],
});

app.mount(document.body);
