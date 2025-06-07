import { isFunction, typeOf } from "../typeChecking";
import type { Store } from "../types";
import { getUniqueId } from "../utils";
import { createLogger, type Logger, type LoggerOptions } from "./logger";
import { effect, type EffectFn, get, type MaybeSignal, peek, type UnsubscribeFn } from "./signals";

type StoreMap = Map<Store<any, any>, any>;

export enum LifecycleEvent {
  WILL_MOUNT,
  DID_MOUNT,
  WILL_UNMOUNT,
  DID_UNMOUNT,
}

// type LifecycleEvent = "willMount" | "didMount" | "willUnmount" | "didUnmount";

type LifecycleListener = () => void;
type LifecycleListeners = {
  [LifecycleEvent.WILL_MOUNT]?: LifecycleListener[];
  [LifecycleEvent.DID_MOUNT]?: LifecycleListener[];
  [LifecycleEvent.WILL_UNMOUNT]?: LifecycleListener[];
  [LifecycleEvent.DID_UNMOUNT]?: LifecycleListener[];
};

enum LifecycleState {
  Unmounted = 0,
  WillMount = 1,
  WillMountByDependent = 2,
  DidMount = 3,
  DidMountByDependent = 4,
  WillUnmount = 5,
  WillUnmountByDependent = 6,
  DidUnmount = 7,
}

/**
 * Manages lifecycle events for a Context.
 */
class ContextLifecycle {
  state = LifecycleState.Unmounted;
  dependents = 0;

  #listeners: LifecycleListeners = {};

  on<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [listener];
    } else if (this.#listeners[event].indexOf(listener) === -1) {
      this.#listeners[event].push(listener);
    }
  }

  off<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    if (this.#listeners[event]) {
      this.#listeners[event].splice(this.#listeners[event].indexOf(listener), 1);

      if (this.#listeners[event].length === 0) {
        delete this.#listeners[event];
      }
    }
  }

  notify<E extends LifecycleEvent>(event: E) {
    if (this.#listeners[event]) {
      for (const listener of this.#listeners[event]) {
        listener();
      }
    }
  }

  emit<E extends LifecycleEvent>(event: E, dependent = false) {
    switch (event) {
      case LifecycleEvent.WILL_MOUNT: {
        if (dependent) this.dependents++;

        if (this.state < LifecycleState.WillMount) {
          this.state = dependent ? LifecycleState.WillMountByDependent : LifecycleState.WillMount;
          this.notify(event);
        }
        break;
      }
      case LifecycleEvent.DID_MOUNT: {
        if (this.state >= LifecycleState.WillMount && this.state < LifecycleState.DidMount) {
          this.state += 2;
          this.notify(event);
        }
        break;
      }
      case LifecycleEvent.WILL_UNMOUNT: {
        if (dependent) {
          this.dependents--;
          if (!this.dependents) {
            this.emit(LifecycleEvent.WILL_UNMOUNT);
          }
        } else if (this.state >= LifecycleState.DidMount && this.state < LifecycleState.WillUnmount) {
          this.notify(event);
          this.state += 2;
        }
        break;
      }
      case LifecycleEvent.DID_UNMOUNT: {
        if (dependent) {
          if (!this.dependents && this.state === LifecycleState.WillUnmountByDependent) {
            this.emit(LifecycleEvent.DID_UNMOUNT);
          }
        } else if (this.state >= LifecycleState.WillUnmount && this.state < LifecycleState.DidUnmount) {
          // Loop back to .Unmounted
          this.state = LifecycleState.DidUnmount % LifecycleState.DidUnmount;
          this.notify(event);
        }
        break;
      }
    }
  }

  dispose() {
    this.emit(LifecycleEvent.WILL_UNMOUNT);
    this.emit(LifecycleEvent.DID_UNMOUNT);
    this.#listeners = {};
  }
}

export interface ContextOptions {
  logger?: LoggerOptions;
}

export interface LinkedContextOptions extends ContextOptions {
  bindLifecycleToParent?: boolean;
}

export interface Context extends Logger {}

export class Context implements Logger {
  #name: MaybeSignal<string>;

  _name: string;
  _lifecycle = new ContextLifecycle();
  _parent?: Context;
  _stores?: StoreMap;
  _state?: Map<any, any>;

  get isMounted() {
    const { state } = this._lifecycle;
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  static linked(parent: Context, name: MaybeSignal<string>, options?: LinkedContextOptions): Context {
    const context = new Context(name, options);
    context._parent = parent;

    if (options?.bindLifecycleToParent) {
      parent._lifecycle.on(LifecycleEvent.WILL_MOUNT, () => {
        context._lifecycle.emit(LifecycleEvent.WILL_MOUNT);
      });
      parent._lifecycle.on(LifecycleEvent.DID_MOUNT, () => {
        context._lifecycle.emit(LifecycleEvent.DID_MOUNT);
      });
      parent._lifecycle.on(LifecycleEvent.WILL_UNMOUNT, () => {
        context._lifecycle.emit(LifecycleEvent.WILL_UNMOUNT);
      });
      parent._lifecycle.on(LifecycleEvent.DID_UNMOUNT, () => {
        context._lifecycle.emit(LifecycleEvent.DID_UNMOUNT);
      });
    } else {
      context._lifecycle.on(LifecycleEvent.WILL_MOUNT, () => {
        parent._lifecycle.emit(LifecycleEvent.WILL_MOUNT, true);
      });
      context._lifecycle.on(LifecycleEvent.DID_MOUNT, () => {
        parent._lifecycle.emit(LifecycleEvent.DID_MOUNT, true);
      });
      context._lifecycle.on(LifecycleEvent.WILL_UNMOUNT, () => {
        parent._lifecycle.emit(LifecycleEvent.WILL_UNMOUNT, true);
      });
      context._lifecycle.on(LifecycleEvent.DID_UNMOUNT, () => {
        parent._lifecycle.emit(LifecycleEvent.DID_UNMOUNT, true);
      });
    }
    return context;
  }

  static emit(event: LifecycleEvent, context: Context) {
    context._lifecycle.emit(event);
  }

  constructor(name: MaybeSignal<string>, options?: ContextOptions) {
    this.#name = name;
    this._name = peek(name);

    // Add logger methods.
    const logger = createLogger(() => get(this.#name), options?.logger);
    const descriptors = Object.getOwnPropertyDescriptors(logger);
    for (const key in descriptors) {
      Object.defineProperty(this, key, descriptors[key]);
    }
  }

  /**
   * Returns the current name of this context.
   */
  getName(): string {
    return peek(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: MaybeSignal<string>) {
    this.#name = name;
    this._name = peek(name); // Try to store name as a readable string for debugging purposes.
  }

  addStore<T>(store: Store<any, T>, options?: any): this {
    if (this._stores?.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      this.warn(`An instance of ${name} was already added on this context.`);
      return this;
    }

    const context = Context.linked(this, store.name, {
      bindLifecycleToParent: true,
      logger: { tag: getUniqueId(), tagName: "uid" },
    });
    try {
      if (!this._stores) this._stores = new Map();
      const result = store.call(context, options, context);
      this._stores.set(store, result);
    } catch (error) {
      throw this.crash(error as Error);
    }

    return this;
  }

  getStore<T>(store: Store<any, T>): T {
    if (!isFunction(store)) {
      throw new StoreError(`Invalid store.`);
    }
    let context: Context = this;
    let result: unknown;
    while (true) {
      result = context._stores?.get(store);
      if (result == null && context._parent != null) {
        context = context._parent;
      } else {
        break;
      }
    }
    if (result == null) {
      throw this.crash(new StoreError(`Store '${store.name}' is not provided by this context.`));
    }
    return result as T;
  }

  /**
   * Schedule a callback function to run just before this context is mounted.
   */
  beforeMount(listener: LifecycleListener) {
    this._lifecycle.on(LifecycleEvent.WILL_MOUNT, listener);
    return () => this._lifecycle.off(LifecycleEvent.WILL_MOUNT, listener);
  }

  /**
   * Schedule a callback function to run after this context is mounted.
   */
  onMount(listener: LifecycleListener) {
    this._lifecycle.on(LifecycleEvent.DID_MOUNT, listener);
    return () => this._lifecycle.off(LifecycleEvent.DID_MOUNT, listener);
  }

  /**
   * Schedule a callback function to run just before this context is unmounted.
   */
  beforeUnmount(listener: LifecycleListener) {
    this._lifecycle.on(LifecycleEvent.WILL_UNMOUNT, listener);
    return () => this._lifecycle.off(LifecycleEvent.WILL_UNMOUNT, listener);
  }

  /**
   * Schedule a callback function to run after this context is unmounted.
   */
  onUnmount(listener: LifecycleListener) {
    this._lifecycle.on(LifecycleEvent.DID_UNMOUNT, listener);
    return () => this._lifecycle.off(LifecycleEvent.DID_UNMOUNT, listener);
  }

  effect(callback: EffectFn) {
    const fn = () => {
      try {
        // Return callback so cleanup function passes through
        return callback();
      } catch (error) {
        this.error(error);
        if (error instanceof Error) {
          this.crash(error);
        } else if (typeof error === "string") {
          this.crash(new Error(error));
        } else {
          this.crash(new Error(`Unknown error thrown in effect callback`));
        }
      }
    };

    if (this._lifecycle.state >= LifecycleState.WillMount) {
      // This code is probably in a lifecycle hook; run the effect immediately and trigger unsubscribe when context unmounts.
      const unsubscribe = effect(fn);
      this._lifecycle.on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
      return unsubscribe;
    } else {
      // Prime the effect to run when the context is mounted and unsubscribe when unmounted, unless unsubscribed before `willMount`.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this._lifecycle.on(LifecycleEvent.WILL_MOUNT, () => {
        if (!disposed) {
          unsubscribe = effect(fn);
          this._lifecycle.on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
        }
      });
      return () => {
        if (unsubscribe != null) {
          disposed = true;
          unsubscribe();
        }
      };
    }
  }

  /**
   * Gets the value stored at `key`, or returns the `defaultValue` if none is set.
   */
  getState<T>(key: any, defaultValue: T): T;

  /**
   * Gets the value stored at `key`, or throws an error if none is set.
   */
  getState<T>(key: any): T;

  /**
   * Returns a Map containing all state values available to this context.
   */
  getState(): Map<any, any>;

  getState<T>(key?: any, defaultValue?: T): T | Map<any, any> {
    if (arguments.length > 0) {
      // Get value by key
      let context: Context = this;
      let value: any;
      while (true) {
        value = context._state?.get(key);
        if (value === undefined && context._parent != null) {
          context = context._parent;
        } else {
          break;
        }
      }
      if (value === undefined) {
        if (arguments.length > 1) {
          return defaultValue!;
        } else {
          throw new Error(`Expected a value for '${String(key)}' but got undefined.`);
        }
      }
      return value;
    } else {
      // Get merged values
      let context: Context = this;
      const entries: [any, any][] = [];
      while (true) {
        if (context._state) {
          entries.push(...context._state.entries());
        }
        if (context._parent != null) {
          context = context._parent;
        } else {
          break;
        }
      }
      return new Map(entries.reverse());
    }
  }

  /**
   * Stores `value` at `key` in this context's state.
   */
  setState<T>(key: any, value: T): void;

  /**
   * For each tuple in `entries`, stores `value` at `key` in this context's state.
   */
  setState(entries: [key: any, value: any][]): void;

  setState() {
    if (!this._state) {
      this._state = new Map();
    }
    if (arguments.length === 2) {
      this._state.set(arguments[0], arguments[1]);
    } else if (typeOf(arguments[0]) === "array") {
      for (const [key, value] of arguments[0]) {
        if (value === undefined) {
          this._state.delete(key);
        } else {
          this._state.set(key, value);
        }
      }
    } else {
      throw new Error(`Invalid arguments.`);
    }

    return this;
  }
}

export function createContext(name: MaybeSignal<string>, options?: ContextOptions) {
  return new Context(name, options);
}

export class StoreError extends Error {}
