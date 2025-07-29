import { isFunction, typeOf } from "../typeChecking";
import type { Store } from "../types";
import { getUniqueId } from "../utils";
import { createLogger, type Logger, type LoggerOptions } from "./logger";
import {
  effect,
  type EffectFn,
  get,
  type MaybeSignal,
  setCurrentContext,
  type UnsubscribeFn,
  untracked,
} from "./signals";

export enum LifecycleEvent {
  WILL_MOUNT = "willMount",
  DID_MOUNT = "didMount",
  WILL_UNMOUNT = "willUnmount",
  DID_UNMOUNT = "didUnmount",
  DISPOSE = "dispose",
}

export type LifecycleEventName = "willMount" | "didMount" | "willUnmount" | "didUnmount" | "dispose";

type LifecycleListener = () => void;

enum LifecycleState {
  Unmounted = 0,
  WillMount = 1,
  DidMount = 2,
  WillUnmount = 3,
  DidUnmount = 4,
  Disposed = 5,
}

const NAME = Symbol("name");
const LIFECYCLE = Symbol("lifecycle");
const PARENT = Symbol("parent");
const STORES = Symbol("stores");
const STATE = Symbol("state");

/**
 * Manages lifecycle events for a Context.
 */
class ContextLifecycle {
  private context;

  state = LifecycleState.Unmounted;
  listeners = new Map<LifecycleEvent, Set<LifecycleListener>>();
  bound?: Set<Context>;

  constructor(context: Context) {
    this.context = context;
  }

  /**
   * Listen for a certain event to be emitted. Listeners are called when the event results in a state change.
   */
  on<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    const listeners = this.listeners.get(event);
    if (!listeners) {
      this.listeners.set(event, new Set([listener]));
    } else {
      listeners.add(listener);
    }
  }

  /**
   * Stop a particular listener from being called when an event is emitted.
   */
  off<E extends LifecycleEvent>(event: E, listener: LifecycleListener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Advance the lifecycle state machine.
   */
  emit<E extends LifecycleEvent>(event: E) {
    switch (event) {
      case LifecycleEvent.WILL_MOUNT: {
        if (this.state < LifecycleState.WillMount) {
          this.state = LifecycleState.WillMount;
          this.notify(event);
        } else {
          this.context.crash(new Error(`Tried to WILL_MOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.DID_MOUNT: {
        if (this.state >= LifecycleState.WillMount && this.state < LifecycleState.DidMount) {
          this.state = LifecycleState.DidMount;
          this.notify(event);
        } else {
          this.context.crash(new Error(`Tried to WILL_UNMOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.WILL_UNMOUNT: {
        if (this.state >= LifecycleState.DidMount && this.state < LifecycleState.WillUnmount) {
          this.notify(event);
          this.state = LifecycleState.WillUnmount;
        } else {
          this.context.crash(new Error(`Tried to WILL_UNMOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.DID_UNMOUNT: {
        if (this.state >= LifecycleState.WillUnmount && this.state < LifecycleState.DidUnmount) {
          // Loop back to .Unmounted
          this.state = LifecycleState.DidUnmount % LifecycleState.DidUnmount;
          this.notify(event);
        } else {
          this.context.crash(new Error(`Tried to DID_UNMOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.DISPOSE: {
        if (this.state === LifecycleState.Unmounted) {
          this.notify(event);
          this.listeners.clear();
          this.bound = undefined;
          this.context[STATE] = undefined;
          this.context[STORES] = undefined;
          this.state = LifecycleState.Disposed;
        } else {
          this.context.crash(new Error(`Tried to DISPOSE context at state ${this.state}`));
        }
        break;
      }
    }
  }

  /**
   * Bind `context` to this lifecycle; when any event is emitted here it will be emitted for `context` as well.
   */
  bind(context: Context) {
    if (!this.bound) {
      this.bound = new Set([context]);
    } else {
      this.bound.add(context);
    }
  }

  /**
   * Call all the event's listeners and re-emit to bound contexts.
   */
  private notify<E extends LifecycleEvent>(event: E) {
    // Call listener functions.
    const listeners = this.listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        listener();
      }
    }
    // Emit to bound contexts.
    if (this.bound) {
      for (const context of this.bound) {
        context[LIFECYCLE].emit(event);
      }
    }
  }
}

export interface ContextGetStateOptions<T> {
  fallback?: T;

  /**
   * Only check this context; skip parent contexts.
   */
  immediate?: boolean;
}

export interface ContextGetStateOptionsWithFallbackValue<T> extends ContextGetStateOptions<T> {
  fallback: T;
}

export interface ContextGetStateMapOptions {
  /**
   * Only include state from this context; skip parent contexts.
   */
  immediate?: boolean;
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

  [NAME]: string;
  [LIFECYCLE] = new ContextLifecycle(this);
  [PARENT]?: Context;
  [STORES]?: Map<Store<any, any>, any>;
  [STATE]?: Map<any, any>;

  get isMounted() {
    const { state } = this[LIFECYCLE];
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  static createChildOf(parent: Context, name: MaybeSignal<string>, options?: LinkedContextOptions): Context {
    const context = new Context(name, options);
    context[PARENT] = parent;
    if (options?.bindLifecycleToParent) parent[LIFECYCLE].bind(context);
    return context;
  }

  /**
   * Emit a lifecycle event to `context`.
   */
  static emit(context: Context, event: LifecycleEvent) {
    context[LIFECYCLE].emit(event);
  }

  constructor(name: MaybeSignal<string>, options?: ContextOptions) {
    this.#name = name;
    this[NAME] = untracked(name);

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
    return untracked(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: MaybeSignal<string>) {
    this.#name = name;
    this[NAME] = untracked(name); // Try to store name as a readable string for debugging purposes.
  }

  /**
   * Creates an instance of a store and attaches it to this context.
   */
  addStore<T>(store: Store<any, T>, options?: any): this {
    if (this[STORES]?.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw this.crash(new Error(`An instance of ${name} was already added on this context.`));
    }

    const context = Context.createChildOf(this, store.name, {
      bindLifecycleToParent: true,
      logger: { tag: getUniqueId(), tagName: "uid" },
    });
    try {
      if (!this[STORES]) this[STORES] = new Map();
      const prevCtx = setCurrentContext(context);
      const result = store.call(context, options, context);
      setCurrentContext(prevCtx);
      this[STORES].set(store, result);
    } catch (error) {
      throw this.crash(error as Error);
    }

    return this;
  }

  /**
   * Retrieves the nearest instance of `store`. If this context doesn't have it, the parent context is checked. This process continues until either:
   * 1. An instance of the store is found and returned.
   * 2. No instance is found and an error is thrown.
   */
  getStore<T>(store: Store<any, T>): T {
    if (!isFunction(store)) {
      throw new Error(`Invalid store.`);
    }
    let context: Context = this;
    let result: unknown;
    while (true) {
      result = context[STORES]?.get(store);
      if (result == null && context[PARENT] != null) {
        context = context[PARENT];
      } else {
        break;
      }
    }
    if (result == null) {
      throw this.crash(new Error(`Store '${store.name}' is not provided by this context.`));
    }
    return result as T;
  }

  /**
   * Registers a `listener` to be called at a specific transition point during this context's lifecycle.
   *
   * Prefer `useMount` and `useUnmount` hooks for general usage.
   */
  onLifecycleTransition(event: LifecycleEventName, listener: LifecycleListener) {
    this[LIFECYCLE].on(event as LifecycleEvent, listener);
    return () => this[LIFECYCLE].off(event as LifecycleEvent, listener);
  }

  effect(callback: EffectFn) {
    const fn = () => {
      try {
        return callback(); // Return callback so cleanup function passes through to effect handler
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

    if (this[LIFECYCLE].state >= LifecycleState.WillMount) {
      // This code is probably in a lifecycle hook; run the effect immediately and trigger unsubscribe when context unmounts.
      const unsubscribe = effect(fn);
      this[LIFECYCLE].on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
      return unsubscribe;
    } else {
      // Prime the effect to run when the context is mounted and unsubscribe when unmounted, unless unsubscribed before `willMount`.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this[LIFECYCLE].on(LifecycleEvent.WILL_MOUNT, () => {
        if (!disposed) {
          unsubscribe = effect(fn);
          this[LIFECYCLE].on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
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
   * Gets the value stored at `key`, or returns `options.fallback` if none is set.
   */
  getState<T>(key: any, options: ContextGetStateOptionsWithFallbackValue<T>): T;

  /**
   * Gets the value stored at `key`, or throws an error if none is set.
   */
  getState<T>(key: any, options?: ContextGetStateOptions<T>): T;

  getState<T>(key: any, options?: ContextGetStateOptions<T>): T {
    const immediate = options?.immediate ?? false;
    let context: Context = this;
    let value: any;
    while (true) {
      value = context[STATE]?.get(key);
      if (value === undefined && !immediate && context[PARENT] != null) {
        context = context[PARENT];
      } else {
        break;
      }
    }
    if (value === undefined) {
      if (options != null && Object.hasOwn(options, "fallback")) {
        return options.fallback!;
      } else {
        throw new Error(`Expected a value for '${String(key)}' but got undefined.`);
      }
    }
    return value;
  }

  /**
   * Returns a Map containing all state values available to this context.
   *
   * Pass `options.immediate` to only include state stored on this context.
   * By default all state stored on parent contexts is also included.
   */
  getStateMap(options?: ContextGetStateMapOptions): Map<any, any> {
    let context: Context = this;
    const immediate = options?.immediate ?? false;
    const entries: [any, any][] = [];
    while (true) {
      if (context[STATE]) {
        entries.push(...context[STATE].entries());
      }
      if (!immediate && context[PARENT] != null) {
        context = context[PARENT];
      } else {
        break;
      }
    }
    return new Map(entries.reverse());
  }

  /**
   * Stores `value` at `key` in this context's state.
   */
  setState<T>(key: any, value: T): void;

  /**
   * For each tuple in `entries`, stores `value` at `key` in this context's state.
   */
  setState(entries: [key: any, value: any][]): void;

  setState(...args: any[]) {
    if (!this[STATE]) {
      this[STATE] = new Map();
    }
    if (args.length === 2) {
      this[STATE].set(args[0], args[1]);
    } else if (typeOf(args[0]) === "array") {
      for (const [key, value] of args[0]) {
        if (value === undefined) {
          this[STATE].delete(key);
        } else {
          this[STATE].set(key, value);
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
