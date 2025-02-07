import { Emitter } from "@manyducks.co/emitter";
import { HTTP } from "../modules/http.js";
import { I18n } from "../modules/i18n.js";
import { Router } from "../modules/router.js";
import { assertInstanceOf, isString } from "../typeChecking.js";
import { colorFromString, createMatcher, noOp } from "../utils.js";
import { DefaultCrashView, type CrashViewProps } from "../views/default-crash-view.js";
import { Passthrough } from "../views/passthrough.js";
import { Batch } from "./batch.js";
import { ContextEvent, type WildcardListenerMap, type ElementContext, type StorableContext } from "./context.js";
import { constructMarkup, createMarkup, groupElements, type Markup, type MarkupElement } from "./markup.js";
import { View, type ViewElement, type ViewFunction } from "./nodes/view.js";
import { createRef, isRef } from "./ref.js";
import { createState, createWatcher, derive, isState, toState, toValue } from "./state.js";
import { Stats } from "./stats.js";
import { isStore, isStoreFactory, StoreError, type Store, type StoreFactory } from "./store.js";

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

export class Dolla implements StorableContext {
  readonly batch: Batch;

  // Remove `private` when there are public methods to call.
  private readonly stats: Stats;

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
    emitter: new Emitter(),
    stores: new Map(),
    viewName: "Dolla",
  };

  #loggles: Loggles = {
    info: "development",
    log: "development",
    warn: "development",
    error: true,
  };
  #match = createMatcher("*,-Dolla.*");

  #wildcardListeners: WildcardListenerMap = new Map();

  // Registration functions for modules.
  // All modules will be registered before mount.
  #modules: (() => Promise<any>)[] = [];

  constructor() {
    this.batch = new Batch(this);
    this.stats = new Stats(this);
    this.http = new HTTP(this);
    this.i18n = new I18n(this);
    this.router = new Router(this);
  }

  watch = this.#watcher.watch;

  createState = createState;
  toState = toState;
  toValue = toValue;
  isState = isState;
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
   * Returns the HTMLElement Dolla is mounted to. This will return undefined until Dolla.mount() is called.
   */
  getRootElement() {
    return this.#rootElement;
  }

  /**
   * Returns the top level view Dolla is rendering inside the root element. This will return undefined until Dolla.mount() is called.
   */
  getRootView() {
    return this.#rootView;
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
  // getAll(): Record<string | symbol, unknown> {
  //   return { ...this.#rootElementContext.data };
  // }

  /**
   * Adds a listener to be called when `eventName` is emitted.
   */
  on<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    if (eventName === "*") {
      const wrappedListener = (_eventName: any, event: ContextEvent<T>) => {
        listener(event);
      };
      this.#rootElementContext.emitter.on(eventName, wrappedListener);
      this.#wildcardListeners.set(listener, wrappedListener);
    } else {
      this.#rootElementContext.emitter.on(eventName, listener);
    }
  }

  /**
   * Removes a listener from the list to be called when `eventName` is emitted.
   */
  off<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    if (eventName === "*") {
      const wrappedListener = this.#wildcardListeners.get(listener);
      if (wrappedListener) {
        this.#rootElementContext.emitter.off(eventName, wrappedListener);
        this.#wildcardListeners.delete(listener);
      }
    } else {
      this.#rootElementContext.emitter.off(eventName, listener);
    }
  }

  /**
   * Adds a listener to be called when `eventName` is emitted. The listener is immediately removed after being called once.
   */
  once<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    if (eventName === "*") {
      const wrappedListener = (_eventName: any, event: ContextEvent<T>) => {
        this.#wildcardListeners.delete(listener);
        listener(event);
      };
      this.#rootElementContext.emitter.once(eventName, wrappedListener);
      this.#wildcardListeners.set(listener, wrappedListener);
    } else {
      this.#rootElementContext.emitter.once(eventName, listener);
    }
  }

  /**
   * Emits a new event to all listeners.
   */
  emit<T = unknown>(eventName: string, detail: T): boolean {
    return this.#rootElementContext.emitter.emit(eventName, new ContextEvent(eventName, detail));
  }

  /**
   * Attaches a new store to this context.
   */
  attachStore(store: Store<any, any>): void {
    const attached = store.attach(this.#rootElementContext);
    if (!attached) {
      let name = store.name ? `'${store.name}'` : "this store";
      console.warn(`An instance of ${name} was already attached to this context.`);
    }
  }

  /**
   * Gets the nearest instance of a store. Throws an error if the store isn't provided higher in the tree.
   */
  useStore<Value>(factory: StoreFactory<any, Value>): Value {
    if (isStoreFactory(factory)) {
      const key = (factory as any).key as string; // The key assigned inside of createStore.
      const store = this.#rootElementContext.stores.get(key);
      if (store == null) {
        throw new StoreError(`Store not found on this context.`);
      } else {
        return store.value;
      }
    } else if (isStore(factory)) {
      throw new StoreError(
        `Received a Store instance. Please pass the Store factory function to useStore without calling it.`,
      );
    } else {
      throw new StoreError(`Invalid store.`);
    }
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

    // Register modules
    // TODO: Handle errors
    await Promise.all(this.#modules.map((register) => register()));

    // Run beforeMount
    // TODO: Handle errors
    await Promise.all(this.#beforeMountCallbacks.map((callback) => callback()));

    this.#rootView.mount(this.#rootElement);
    this.#isMounted = true;

    // Run onMount for stores.
    for (const store of this.#rootElementContext.stores.values()) {
      store.handleMount();
    }

    // Run onMount
    // TODO: Handle errors
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

export function getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }
  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}
