import { type DOMHandle, createMarkup, type Markup, createRef, isRef } from "../markup.js";
import {
  type Signal,
  signalify,
  createSignal,
  createSettableSignal,
  toSettableSignal,
  designalify,
  derive,
  watch,
} from "../signals.js";
import { assertInstanceOf, isString } from "../typeChecking.js";
import { colorFromString, createMatcher, getDefaultConsole, noOp } from "../utils.js";
import { constructView, type ViewFunction } from "../view.js";
import { DefaultView } from "../views/default-view.js";

import { HTTP } from "./http.js";
import { Language } from "./language.js";
import { Render } from "./render.js";
import { Router } from "./router.js";

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
  #isMounted = false;
  #env: Environment = "production";
  #rootElement?: HTMLElement;
  #rootView?: DOMHandle;

  http: HTTP;
  language: Language;
  render: Render;
  router: Router;

  #beforeMountCallbacks: Array<() => void | Promise<void>> = [];
  #onMountCallbacks: Array<() => void> = [];
  #beforeUnmountCallbacks: Array<() => void | Promise<void>> = [];
  #onUnmountCallbacks: Array<() => void> = [];

  #loggles: Loggles = {
    info: "development",
    log: "development",
    warn: "development",
    error: true,
  };
  #match = createMatcher("*,-dolla/*");

  constructor() {
    const self = this;

    this.http = new HTTP();
    this.language = new Language(this);
    this.render = new Render(this);
    this.router = new Router(this, {
      get rootElement() {
        return self.#rootElement;
      },
      get rootView() {
        return self.#rootView;
      },
    });
  }

  createSignal = createSignal;
  createSettableSignal = createSettableSignal;
  toSettableSignal = toSettableSignal;
  signalify = signalify;
  designalify = designalify;
  derive = derive;
  watch = watch;

  createRef = createRef;
  isRef = isRef;

  get isMounted() {
    return this.#isMounted;
  }

  get env() {
    return this.#env;
  }

  set env(value: Environment) {
    this.#env = value;
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

    let rootViewMarkup: Markup;

    if (view) {
      rootViewMarkup = createMarkup(view);
    } else {
      rootViewMarkup = createMarkup(DefaultView);
    }

    // First, initialize the root view. The router store needs this to connect the initial route.
    const elementContext = { dolla: this };
    this.#rootView = constructView(elementContext, rootViewMarkup.type as ViewFunction<any>, rootViewMarkup.props);

    // Run beforeMount
    await Promise.all(this.#beforeMountCallbacks.map((callback) => callback()));

    this.#rootView.connect(this.#rootElement);

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

    this.#rootView?.disconnect();

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
   * Update log level settings. Values that are not passed will remain unchanged.
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

  createLogger(name: string | Signal<string>, options?: LoggerOptions): Logger {
    const $name = signalify(name);

    const _console = options?.console ?? getDefaultConsole();

    const self = this;

    return {
      get info() {
        const name = $name.get();
        if (
          self.#loggles.info === false ||
          (isString(self.#loggles.info) && self.#loggles.info !== self.env) ||
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
        const name = $name.get();
        if (
          self.#loggles.log === false ||
          (isString(self.#loggles.log) && self.#loggles.log !== self.env) ||
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
        const name = $name.get();
        if (
          self.#loggles.warn === false ||
          (isString(self.#loggles.warn) && self.#loggles.warn !== self.env) ||
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
        const name = $name.get();
        if (
          self.#loggles.error === false ||
          (isString(self.#loggles.error) && self.#loggles.error !== self.env) ||
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
        // TODO: Handle crash
        // _CRASH({ error, loggerName: $name.get(), uid: options?.uid });
      },
    };
  }

  constructView<P>(view: ViewFunction<P>, props: P, children: Markup[] = []) {
    const elementContext = { dolla: this };
    return constructView(elementContext, view, props, children);
  }
}
