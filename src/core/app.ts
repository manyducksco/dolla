import { isFunction, isObject, typeOf } from "../typeChecking.js";
import type { View } from "../types";
import { Context, LifecycleEvent } from "./context.js";
import { createI18n, I18N, type I18n, I18nHandle, type I18nOptions } from "./i18n.js";
import { ViewNode } from "./nodes/view.js";
import { CrashViewProps, DefaultCrashView } from "./views/default-crash-view.js";

/**
 * Represents the Dolla app's parent element in context state.
 */
export const PARENT_ELEMENT = Symbol("parentElement");

export interface DollaOptions {
  /**
   * Main view to mount in the app. Used unless `routes` is defined.
   */
  view: View<{}>;

  /**
   * View to show when a $debug crash is invoked. Takes information about the crash.
   */
  crashView?: View<CrashViewProps>;

  /**
   * Options for language translations.
   */
  i18n?: I18nOptions;
}

class App {
  #context: Context;
  #mounted = false;

  #view: View<{}>;
  #crashView: View<CrashViewProps> = DefaultCrashView;
  #root?: ViewNode<{}>;

  #cleanup: (() => void)[] = [];

  #i18n: I18nHandle;

  readonly i18n: I18n;

  constructor(options: DollaOptions) {
    this.#context = new Context("App");

    this.#view = options.view;

    if (options.crashView) {
      this.#crashView = options.crashView;
    }

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

    this.#context.setState(PARENT_ELEMENT, parentElement);

    this.#cleanup.push(
      this.#context.catchError((error, info) => {
        this.unmount().then(() => {
          new ViewNode(this.#context, this.#crashView, { error, info }).mount(parentElement);
        });
      }),
    );

    this.#context.emit(LifecycleEvent.WILL_MOUNT);

    await this.#i18n.mount();

    // Mount root view.
    this.#root = new ViewNode(this.#context, this.#view, {});
    this.#root.mount(parentElement);

    this.#mounted = true;

    this.#context.emit(LifecycleEvent.DID_MOUNT);
  }

  async unmount() {
    if (!this.#mounted) return Promise.resolve();

    this.#context.emit(LifecycleEvent.WILL_UNMOUNT);
    this.#mounted = false;

    this.#root?.unmount(false);

    this.#i18n.unmount();

    for (const callback of this.#cleanup) {
      callback();
    }
    this.#cleanup = [];

    this.#context.emit(LifecycleEvent.DID_UNMOUNT);
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
export function dolla(options: DollaOptions): App;

export function dolla(init: View<{}> | DollaOptions) {
  if (isFunction<View<{}>>(init)) {
    return new App({ view: init });
  } else if (isObject<DollaOptions>(init)) {
    return new App(init);
  } else {
    throw new Error(`Expected a view function or options object. Got: ${typeOf(init)}`);
  }
}
