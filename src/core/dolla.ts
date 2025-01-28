import {
  constructMarkup,
  createMarkup,
  groupElements,
  type ElementContext,
  type Markup,
  type MarkupElement,
} from "./markup.js";
import {
  createRef,
  createSettableState,
  createState,
  createWatcher,
  derive,
  isRef,
  toSettableState,
  toState,
  valueOf,
} from "./state.js";
import { assertInstanceOf, isString } from "../typeChecking.js";
import { colorFromString, createMatcher, getDefaultConsole, noOp } from "../utils.js";
import { View, type ViewElement, type ViewFunction } from "./view.js";
import { DefaultCrashView, type CrashViewProps } from "../views/default-crash-view.js";
import { Passthrough } from "../views/passthrough.js";

import { Batch } from "./batch.js";
import { HTTP } from "../modules/http.js";
import { I18n } from "../modules/i18n.js";
import { Router } from "../modules/router.js";

// Affects which log messages will print and how much debugging info is included in the DOM.
export type Environment = "development" | "production";

/**
 * Log type toggles. Each message category can be turned on or off or enabled only in a specific environment.
 */
export type Loggles = {
  info: boolean | Environment;
  log: boolean | Environment;
  warn: boolean | Environment;
  error: boolean | Environment;
};

export interface Logger {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  crash(error: Error): void;

  setName(name: string): Logger;
}

export interface LoggerErrorContext {
  error: Error;
  loggerName: string;
  uid?: string;
}

export type LoggerOptions = {
  /**
   * Console object to use for logging (mostly for testing). Uses window.console by default.
   */
  console?: any;

  /**
   * Unique ID to print with logs. Makes it easier to track down messages from specific view instances.
   */
  uid?: string;
};

export class Dolla {
  readonly batch: Batch;

  readonly http: HTTP;
  readonly i18n: I18n;
  readonly router: Router;

  #isMounted = false;
  #env: Environment = "production";
  #rootElement?: HTMLElement;
  #rootView?: ViewElement;
  #crashView: ViewFunction<CrashViewProps> = DefaultCrashView;

  #watcher = createWatcher();

  #beforeMountCallbacks: Array<() => void | Promise<void>> = [];
  #onMountCallbacks: Array<() => void> = [];
  #beforeUnmountCallbacks: Array<() => void | Promise<void>> = [];
  #onUnmountCallbacks: Array<() => void> = [];

  #rootElementContext: ElementContext = {
    root: this,
    data: {},
  };

  #loggles: Loggles = {
    info: "development",
    log: "development",
    warn: "development",
    error: true,
  };
  #match = createMatcher("*,-dolla/*");

  constructor() {
    const self = this;

    this.batch = new Batch(this);

    this.http = new HTTP();
    this.i18n = new I18n(this);
    this.router = new Router(this, {
      get rootElement() {
        return self.#rootElement;
      },
      get rootView() {
        return self.#rootView;
      },
    });
  }

  watch = this.#watcher.watch;

  createState = createState;
  createSettableState = createSettableState;
  toSettableState = toSettableState;
  toState = toState;
  valueOf = valueOf;
  derive = derive;
  createWatcher = createWatcher;

  createRef = createRef;
  isRef = isRef;

  /**
   * True when the app is connected to a DOM node and displayed to the user.
   */
  get isMounted() {
    return this.#isMounted;
  }

  /**
   * Get the current environment that this app is running in.
   * Environment affects which log messages will print and how much debugging info is included in the DOM.
   */
  getEnv() {
    return this.#env;
  }

  /**
   * Sets the environment that this app is running in.
   * Environment affects which log messages will print and how much debugging info is included in the DOM.
   */
  setEnv(value: Environment) {
    this.#env = value;
  }

  /**
   * Sets the view that will be shown when the `crash` method is called on any logger.
   * When a crash is reported the app will be unmounted and replaced with this crash page.
   */
  setCrashView(view: ViewFunction<CrashViewProps>) {
    this.#crashView = view;
  }

  /**
   * Sets a context variable and returns its value. Context variables are accessible on the app and in child views.
   */
  set<T>(key: string | symbol, value: T): T {
    this.#rootElementContext.data[key] = value;
    return value;
  }

  /**
   * Gets the value of a context variable. Returns null if the variable is not set.
   */
  get<T>(key: string | symbol): T | null {
    return (this.#rootElementContext.data[key] as T) ?? null;
  }

  /**
   * Returns an object of all context variables stored at the app level.
   */
  getAll(): Record<string | symbol, unknown> {
    return { ...this.#rootElementContext.data };
  }

  async mount(selector: string, view?: ViewFunction<any>): Promise<void>;
  async mount(element: HTMLElement, view?: ViewFunction<any>): Promise<void>;

  async mount(target: string | HTMLElement, view?: ViewFunction<any>) {
    if (this.#isMounted) {
      throw new Error(`Dolla is already mounted.`);
    }

    if (isString(target)) {
      const match = document.querySelector<HTMLElement>(target);
      assertInstanceOf(HTMLElement, match, `Selector '${target}' did not match any element.`);
      this.#rootElement = match!;
    } else {
      assertInstanceOf(HTMLElement, target, "Expected an HTML element or a selector string. Got type: %t, value: %v");
      this.#rootElement = target;
    }

    // First, initialize the root view. The router store needs this to connect the initial route.
    const rootViewMarkup = createMarkup(view ?? Passthrough);
    this.#rootView = this.constructView(rootViewMarkup.type as ViewFunction<any>, rootViewMarkup.props);

    // Run beforeMount
    await Promise.all(this.#beforeMountCallbacks.map((callback) => callback()));

    this.#rootView.mount(this.#rootElement);

    // App is now fully mounted.
    this.#isMounted = true;

    // Run onMount
    for (const callback of this.#onMountCallbacks) {
      callback();
    }
  }

  async unmount() {
    if (!this.#isMounted) return;

    // Run beforeUnmount
    await Promise.all(this.#beforeUnmountCallbacks.map((callback) => callback()));

    this.#rootView?.unmount(false);

    this.#watcher.stopAll();

    this.#isMounted = false;

    // Run onUnmount
    for (const callback of this.#onUnmountCallbacks) {
      callback();
    }
  }

  /**
   * Registers a `callback` to run after `Dolla.mount` is called, before the app is mounted. If `callback` returns a Promise,
   * it will be awaited before mounting finishes. Use this to perform initial setup before the app is displayed to the user.
   */
  beforeMount(callback: () => void | Promise<void>) {
    this.#beforeMountCallbacks.push(callback);
  }

  /**
   * Registers a `callback` to run after the app is mounted.
   */
  onMount(callback: () => void) {
    this.#onMountCallbacks.push(callback);
  }

  /**
   * Registers a `callback` to run after `Dolla.unmount` is called, before the app is unmounted. If `callback` returns a Promise,
   * it will be awaited before unmounting finishes. Use this to perform cleanup.
   */
  beforeUnmount(callback: () => void | Promise<void>) {
    this.#beforeUnmountCallbacks.push(callback);
  }

  /**
   * Registers a `callback` to run after the app is unmounted.
   */
  onUnmount(callback: () => void) {
    this.#onUnmountCallbacks.push(callback);
  }

  /**
   * Update log type toggles. Values that are not passed will remain unchanged.
   */
  setLoggles(options: Partial<Loggles>) {
    for (const key in options) {
      const value = options[key as keyof Loggles];
      if (value) {
        this.#loggles[key as keyof Loggles] = value;
      }
    }
  }

  setLogFilter(filter: string | RegExp) {
    this.#match = createMatcher(filter);
  }

  createLogger(name: string, options?: LoggerOptions): Logger {
    const _console = options?.console ?? getDefaultConsole();

    const self = this;

    return {
      setName(newName: string) {
        name = newName;
        return this;
      },

      get info() {
        if (
          self.#loggles.info === false ||
          (isString(self.#loggles.info) && self.#loggles.info !== self.getEnv()) ||
          !self.#match(name)
        ) {
          return noOp;
        } else {
          let label = `%c${name}`;
          if (options?.uid) {
            label += ` %c[uid: %c${options.uid}%c]`;
          } else {
            label += `%c%c%c`;
          }
          return _console.info.bind(
            _console,
            label,
            `color:${colorFromString(label)};font-weight:bold`,
            `color:#777`,
            `color:#aaa`,
            `color:#777`,
          );
        }
      },

      get log() {
        if (
          self.#loggles.log === false ||
          (isString(self.#loggles.log) && self.#loggles.log !== self.getEnv()) ||
          !self.#match(name)
        ) {
          return noOp;
        } else {
          let label = `%c${name}`;
          if (options?.uid) {
            label += ` %c[uid: %c${options.uid}%c]`;
          } else {
            label += `%c%c%c`;
          }
          return _console.log.bind(
            _console,
            label,
            `color:${colorFromString(label)};font-weight:bold`,
            `color:#777`,
            `color:#aaa`,
            `color:#777`,
          );
        }
      },

      get warn() {
        if (
          self.#loggles.warn === false ||
          (isString(self.#loggles.warn) && self.#loggles.warn !== self.getEnv()) ||
          !self.#match(name)
        ) {
          return noOp;
        } else {
          let label = `%c${name}`;
          if (options?.uid) {
            label += ` %c[uid: %c${options.uid}%c]`;
          } else {
            label += `%c%c%c`;
          }
          return _console.warn.bind(
            _console,
            label,
            `color:${colorFromString(label)};font-weight:bold`,
            `color:#777`,
            `color:#aaa`,
            `color:#777`,
          );
        }
      },

      get error() {
        if (
          self.#loggles.error === false ||
          (isString(self.#loggles.error) && self.#loggles.error !== self.getEnv()) ||
          !self.#match(name)
        ) {
          return noOp;
        } else {
          let label = `%c${name}`;
          if (options?.uid) {
            label += ` %c[uid: %c${options.uid}%c]`;
          } else {
            label += `%c%c%c`;
          }
          return _console.error.bind(
            _console,
            label,
            `color:${colorFromString(label)};font-weight:bold`,
            `color:#777`,
            `color:#aaa`,
            `color:#777`,
          );
        }
      },

      crash(error: Error) {
        if (self.isMounted) {
          // Unmount the app.
          self.unmount();

          // Mount the crash page
          const crashPage = self.constructView(self.#crashView, {
            error,
            loggerName: name,
            uid: options?.uid,
          });
          crashPage.mount(self.#rootElement!);
        }

        throw error;
      },
    };
  }

  /**
   *
   */
  constructView<P>(view: ViewFunction<P>, props: P, children: Markup[] = []): ViewElement {
    return new View(this.#rootElementContext, view, props, children);
  }

  /**
   *
   */
  constructMarkup(markup: Markup | Markup[]): MarkupElement {
    return groupElements(constructMarkup(this.#rootElementContext, markup));
  }
}
