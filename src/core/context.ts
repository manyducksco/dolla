import { isFunction, typeOf } from "../typeChecking";
import { getUniqueId } from "../utils";
import { createLogger, Logger, LoggerOptions } from "./logger";
import { effect, type EffectFn, get, type MaybeSignal, peek, type UnsubscribeFn } from "./signals";

/**
 *
 */
export type Store<Options, Value> = (this: Context, options: Options, context: Context) => Value;

type StoreMap = Map<Store<any, any>, any>;
export const globalStores: StoreMap = new Map();

type LifecycleListener = () => void;
type ContextLifecycleListeners = {
  willMount?: LifecycleListener[];
  didMount?: LifecycleListener[];
  willUnmount?: LifecycleListener[];
  didUnmount?: LifecycleListener[];
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

  #listeners: ContextLifecycleListeners = {};

  on<E extends keyof ContextLifecycleListeners>(event: E, listener: LifecycleListener) {
    if (!this.#listeners[event]) {
      this.#listeners[event] = [listener];
    } else if (this.#listeners[event].indexOf(listener) === -1) {
      this.#listeners[event].push(listener);
    }
  }

  off<E extends keyof ContextLifecycleListeners>(event: E, listener: LifecycleListener) {
    if (this.#listeners[event]) {
      this.#listeners[event].splice(this.#listeners[event].indexOf(listener), 1);

      if (this.#listeners[event].length === 0) {
        delete this.#listeners[event];
      }
    }
  }

  willMount(dependent = false) {
    if (dependent) this.dependents++;

    if (this.state < LifecycleState.WillMount) {
      if (this.#listeners.willMount) {
        for (const listener of this.#listeners.willMount) {
          listener();
        }
      }
      this.state = dependent ? LifecycleState.WillMountByDependent : LifecycleState.WillMount;
    }
  }
  didMount(dependent = false) {
    if (this.state >= LifecycleState.WillMount && this.state < LifecycleState.DidMount) {
      this.state += 2;
      if (this.#listeners.didMount) {
        for (const listener of this.#listeners.didMount) {
          listener();
        }
      }
    }
  }
  willUnmount(dependent = false) {
    if (dependent) {
      this.dependents--;
      if (!this.dependents) {
        this.willUnmount();
      }
    } else if (this.state >= LifecycleState.DidMount && this.state < LifecycleState.WillUnmount) {
      if (this.#listeners.willUnmount) {
        for (const listener of this.#listeners.willUnmount) {
          listener();
        }
      }
      this.state += 2;
    }
  }
  didUnmount(dependent = false) {
    if (dependent) {
      if (!this.dependents && this.state === LifecycleState.WillUnmountByDependent) {
        this.didUnmount();
      }
    } else if (this.state >= LifecycleState.WillUnmount && this.state < LifecycleState.DidUnmount) {
      // Loop back to .Unmounted
      this.state = LifecycleState.DidUnmount % LifecycleState.DidUnmount;
      if (this.#listeners.didUnmount) {
        for (const listener of this.#listeners.didUnmount) {
          listener();
        }
      }
    }
  }

  dispose() {
    this.willUnmount();
    this.didUnmount();
    this.#listeners = {};
  }
}

export interface ContextOptions {
  logger?: LoggerOptions;
}

export interface InheritedContextOptions extends ContextOptions {
  bindLifecycleToParent?: boolean;
}

export interface Context extends Logger {}

export class Context implements Logger {
  _name!: string;
  _parent?: Context;
  _lifecycle = new ContextLifecycle();
  _stores: StoreMap = new Map();
  _state = new Map();
  #name!: MaybeSignal<string>;

  get isMounted() {
    const { state } = this._lifecycle;
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  static inherit(parent: Context, name: MaybeSignal<string>, options?: InheritedContextOptions): Context {
    const context = new Context(name, options);
    context._parent = parent;

    if (options?.bindLifecycleToParent) {
      parent._lifecycle.on("willMount", () => {
        context._lifecycle.willMount();
      });
      parent._lifecycle.on("didMount", () => {
        context._lifecycle.didMount();
      });
      parent._lifecycle.on("willUnmount", () => {
        context._lifecycle.willUnmount();
      });
      parent._lifecycle.on("didUnmount", () => {
        context._lifecycle.didUnmount();
      });
    } else {
      context._lifecycle.on("willMount", () => {
        parent._lifecycle.willMount(true);
      });
      context._lifecycle.on("didMount", () => {
        parent._lifecycle.didMount(true);
      });
      context._lifecycle.on("willUnmount", () => {
        parent._lifecycle.willUnmount(true);
      });
      context._lifecycle.on("didUnmount", () => {
        parent._lifecycle.didUnmount(true);
      });
    }
    return context;
  }

  constructor(name: MaybeSignal<string>, options?: ContextOptions) {
    this.setName(name);

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
    if (this._stores.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      this.warn(`An instance of ${name} was already added on this context.`);
      return this;
    }

    const context = Context.inherit(this, store.name, {
      bindLifecycleToParent: true,
      logger: { tag: getUniqueId(), tagName: "uid" },
    });
    try {
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
      result = context._stores.get(store);
      if (result == null && context._parent != null) {
        context = context._parent;
      } else {
        break;
      }
    }
    if (result == null) {
      result = globalStores.get(store);
    }
    if (result == null) {
      throw this.crash(new StoreError(`Store '${store.name}' is not provided by this context.`));
    }
    return result as T;
  }

  beforeMount(listener: LifecycleListener) {
    this._lifecycle.on("willMount", listener);
    return () => this._lifecycle.off("willMount", listener);
  }

  onMount(listener: LifecycleListener) {
    this._lifecycle.on("didMount", listener);
    return () => this._lifecycle.off("didMount", listener);
  }

  beforeUnmount(listener: LifecycleListener) {
    this._lifecycle.on("willUnmount", listener);
    return () => this._lifecycle.off("willUnmount", listener);
  }

  onUnmount(listener: LifecycleListener) {
    this._lifecycle.on("didUnmount", listener);
    return () => this._lifecycle.off("didUnmount", listener);
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
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(fn);
      this._lifecycle.on("didUnmount", unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this._lifecycle.on("willMount", () => {
        if (!disposed) {
          unsubscribe = effect(fn);
          this._lifecycle.on("didUnmount", unsubscribe);
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
   * Gets all values available to this context.
   */
  getState(): Map<any, any>;

  getState<T>(key?: any, defaultValue?: T): T | Map<any, any> {
    if (arguments.length > 0) {
      // Get one
      let context: Context = this;
      let value: any;
      while (true) {
        value = context._state.get(key);
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
      // Get all
      let context: Context = this;
      const entries: [any, any][] = [];
      while (true) {
        entries.push(...context._state.entries());
        if (context._parent != null) {
          context = context._parent;
        } else {
          break;
        }
      }
      return new Map(entries.reverse());
    }
  }

  setState<T>(key: any, value: T): void;
  // setState(values: Partial<Record<any, any>>): void;
  setState(entries: [any, any][]): void;

  setState() {
    if (arguments.length === 2) {
      this._state.set(arguments[0], arguments[1]);
    } else if (typeOf(arguments[0]) === "object") {
      for (const key in arguments[0]) {
        const value = arguments[0][key];
        if (value === undefined) {
          this._state.delete(key);
        } else {
          this._state.set(key, value);
        }
      }
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
