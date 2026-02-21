import { assertFunction, typeOf } from "../typeChecking";
import type { Store } from "../types";
import { getUniqueId } from "../utils";
import { createLogger, type Logger, type LoggerOptions } from "./logger";
import {
  watch,
  type WatchCallback,
  Gettable,
  Getter,
  MaybeReadable,
  read,
  setCurrentContext,
  type UnsubscribeFn,
  Readable,
} from "./signal";

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
          this.context.logger.crash(new Error(`Tried to WILL_MOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.DID_MOUNT: {
        if (this.state >= LifecycleState.WillMount && this.state < LifecycleState.DidMount) {
          this.state = LifecycleState.DidMount;
          this.notify(event);
        } else {
          this.context.logger.crash(new Error(`Tried to WILL_UNMOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.WILL_UNMOUNT: {
        if (this.state >= LifecycleState.DidMount && this.state < LifecycleState.WillUnmount) {
          this.notify(event);
          this.state = LifecycleState.WillUnmount;
        } else {
          this.context.logger.crash(new Error(`Tried to WILL_UNMOUNT context at state ${this.state}`));
        }
        break;
      }
      case LifecycleEvent.DID_UNMOUNT: {
        if (this.state >= LifecycleState.WillUnmount && this.state < LifecycleState.DidUnmount) {
          // Loop back to .Unmounted
          this.state = LifecycleState.DidUnmount % LifecycleState.DidUnmount;
          this.notify(event);
        } else {
          this.context.logger.crash(new Error(`Tried to DID_UNMOUNT context at state ${this.state}`));
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
          this.context.logger.crash(new Error(`Tried to DISPOSE context at state ${this.state}`));
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
  shallow?: boolean;
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

export class Context {
  #name: Gettable<string>;

  logger: Logger;

  [LIFECYCLE] = new ContextLifecycle(this);
  [PARENT]?: Context;
  [STORES]?: Map<Store<any, any>, any>;
  [STATE]?: Map<any, any>;

  #errorHandler?: (error: unknown) => void;

  get isMounted() {
    const { state } = this[LIFECYCLE];
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  static createChildOf(
    parent: Context,
    name: MaybeReadable<string> | Getter<string>,
    options?: LinkedContextOptions,
  ): Context {
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

  constructor(name: Readable<string> | Getter<string> | string, options?: ContextOptions) {
    this.#name = name;

    // Wrapping the get in another getter in case this.#name changes to a different object between calls.
    this.logger = createLogger(() => read(this.#name), options?.logger);
  }

  /**
   * Returns the current name of this context.
   */
  getName(): string {
    return read(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: Readable<string> | Getter<string> | string) {
    this.#name = name;
  }

  /**
   * Creates an instance of a store and attaches it to this context.
   */
  provideStore<T>(store: Store<any, T>, options?: any): this {
    if (this[STORES]?.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw this.logger.crash(new Error(`An instance of ${name} was already added on this context.`));
    }

    const context = Context.createChildOf(this, store.name, {
      bindLifecycleToParent: true,
      logger: { tag: getUniqueId(), tagName: "uid" },
    });
    try {
      if (!this[STORES]) this[STORES] = new Map();
      const prevCtx = setCurrentContext(context);
      const result = store(options);
      setCurrentContext(prevCtx);
      this[STORES].set(store, result);
    } catch (error) {
      throw this.logger.crash(error as Error);
    }

    return this;
  }

  /**
   * Retrieves the nearest instance of `store`. If this context doesn't have it, the parent context is checked. This process continues until either:
   * 1. An instance of the store is found and returned.
   * 2. No instance is found and an error is thrown.
   */
  useStore<T>(store: Store<any, T>): T {
    assertFunction(store, "Expected a store function. Got: %t");

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
      throw this.logger.crash(new Error(`Store '${store.name}' is not provided by this context.`));
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

  watch(callback: WatchCallback) {
    const fn = () => {
      try {
        return callback(); // Return callback so cleanup function passes through to effect handler
      } catch (error) {
        this.logger.error(error);
        if (error instanceof Error) {
          this.logger.crash(error);
        } else if (typeof error === "string") {
          this.logger.crash(new Error(error));
        } else {
          this.logger.crash(new Error(`Unknown error thrown in effect callback`));
        }
      }
    };

    if (this[LIFECYCLE].state >= LifecycleState.WillMount) {
      // This code is probably in a lifecycle hook; run the effect immediately and trigger unsubscribe when context unmounts.
      const unsubscribe = watch(fn);
      this[LIFECYCLE].on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
      return unsubscribe;
    } else {
      // Prime the effect to run when the context is mounted and unsubscribe when unmounted, unless unsubscribed before `willMount`.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this[LIFECYCLE].on(LifecycleEvent.WILL_MOUNT, () => {
        if (!disposed) {
          unsubscribe = watch(fn);
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
    const shallow = options?.shallow ?? false;
    let context: Context = this;
    let value: any;
    while (true) {
      value = context[STATE]?.get(key);
      if (value === undefined && !shallow && context[PARENT] != null) {
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

  /**
   * Propagates an error up the context tree.
   */
  throwError(error: unknown) {
    this.bubbleError(error, []);
  }

  /**
   * Catches errors thrown on this context or a child context.
   */
  catchError(callback: (error: unknown) => void) {
    if (this.#errorHandler) {
      this.logger.warn("Overwriting existing error handler");
    }
    this.#errorHandler = callback;
  }

  bubbleError(error: unknown, chain: Context[]) {
    if (this.#errorHandler) {
      this.#errorHandler(error);
    } else if (this[PARENT]) {
      this[PARENT].bubbleError(error, [...chain, this]);
    } else {
      // Crash app
    }
  }
}
