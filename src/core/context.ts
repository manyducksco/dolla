import { assertFunction } from "../typeChecking";
import type { Store } from "../types";
import { getUniqueId } from "../utils";
import { createLogger, type Logger, type LoggerOptions } from "./logger";
import {
  type Gettable,
  type Getter,
  type MaybeReadable,
  read,
  type Readable,
  type UnsubscribeFn,
  watch,
  type WatchCallback,
} from "./signal";

let currentContext: Context | undefined;

export function getCurrentContext(): Context | undefined {
  return currentContext;
}

export function setCurrentContext(context: Context | undefined) {
  const prevContext = currentContext;
  currentContext = context;
  return prevContext;
}

export function performInContext(context: Context | undefined, callback: () => void) {
  const prevContext = currentContext;
  currentContext = context;
  try {
    callback();
  } finally {
    currentContext = prevContext;
  }
}

export enum LifecycleEvent {
  WILL_MOUNT = "willMount",
  DID_MOUNT = "didMount",
  WILL_UNMOUNT = "willUnmount",
  DID_UNMOUNT = "didUnmount",
  DISPOSE = "dispose",
}

export type LifecycleEventName = "willMount" | "didMount" | "willUnmount" | "didUnmount" | "dispose";

type LifecycleListener = () => any;

enum LifecycleState {
  Unmounted = 0,
  WillMount = 1,
  DidMount = 2,
  WillUnmount = 3,
  DidUnmount = 4,
  Disposed = 5,
}

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
    return () => this.off(event, listener);
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
          this.context.state = undefined;
          this.context.stores = undefined;
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
        context.lifecycle.emit(event);
      }
    }
  }
}

export interface ContextOptions {
  logger?: LoggerOptions;
}

export interface LinkedContextOptions extends ContextOptions {
  bindLifecycleToParent?: boolean;
}

export interface ErrorInfo {
  /**
   * The context where this error was originally thrown.
   */
  source: {
    id: string;
    name: string;
  };

  /**
   * A string representing the stack of contexts this error bubbled through before being caught.
   */
  contextStack: string;
}

export class Context {
  readonly id = getUniqueId();
  #name: Gettable<string>;

  lifecycle = new ContextLifecycle(this);
  logger: Logger;
  parent?: Context;
  stores?: Map<Store<any, any>, any>;
  state?: Map<any, any>;

  #errorHandler?: (error: unknown, info: ErrorInfo) => void;

  constructor(name: Readable<string> | Getter<string> | string, options?: ContextOptions) {
    this.#name = name;

    // Wrapping the get in another getter in case this.#name changes to a different object between calls.
    this.logger = createLogger(() => read(this.#name), {
      tag: this.id,
      tagName: "id",
      onCrash: (error) => {
        this.throwError(error);
      },
    });
  }

  isMounted() {
    const { state } = this.lifecycle;
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  createChild(name: MaybeReadable<string> | Getter<string>, options?: LinkedContextOptions): Context {
    const context = new Context(name, options);
    context.parent = this;
    if (options?.bindLifecycleToParent) this.lifecycle.bind(context);
    return context;
  }

  /**
   * Emits a lifecycle event to this context.
   */
  emit(event: LifecycleEvent) {
    this.lifecycle.emit(event);
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
    if (this.stores?.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw this.logger.crash(new Error(`An instance of ${name} was already added on this context.`));
    }

    // Context is bound and therefore will be disposed when this context is disposed.
    const context = this.createChild(store.name, {
      bindLifecycleToParent: true,
    });

    performInContext(context, () => {
      if (!this.stores) this.stores = new Map();
      this.stores.set(store, store(options));
    });

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
      result = context.stores?.get(store);
      if (result == null && context.parent != null) {
        context = context.parent;
      } else {
        break;
      }
    }
    if (result == null) {
      throw this.throwError(new Error(`Store '${store.name}' is not provided by this context.`));
    }
    return result as T;
  }

  /**
   * Registers a `listener` to be called at a specific transition point during this context's lifecycle.
   *
   * Prefer `useMount` and `useUnmount` hooks for general usage.
   */
  onLifecycleTransition(event: LifecycleEventName, listener: LifecycleListener) {
    return this.lifecycle.on(event as LifecycleEvent, () => {
      try {
        const result = listener();
        if (result instanceof Promise) {
          result.catch(this.throwError);
        }
      } catch (error) {
        this.throwError(error);
      }
    });
  }

  watch(callback: WatchCallback) {
    const fn = () => {
      try {
        return callback(); // Return callback so cleanup function passes through to effect handler
      } catch (error) {
        this.throwError(error);
      }
    };

    if (this.lifecycle.state >= LifecycleState.WillMount) {
      // This code is probably in a lifecycle hook; run the effect immediately and trigger unsubscribe when context unmounts.
      const unsubscribe = watch(fn);
      this.lifecycle.on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
      return unsubscribe;
    } else {
      // Prime the effect to run when the context is mounted and unsubscribe when unmounted, unless unsubscribed before `willMount`.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this.lifecycle.on(LifecycleEvent.WILL_MOUNT, () => {
        if (!disposed) {
          unsubscribe = watch(fn);
          this.lifecycle.on(LifecycleEvent.DID_UNMOUNT, unsubscribe);
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
   * Gets the value stored at `key`. Searches up the context chain if this context doesn't have it.
   */
  getState<T>(key: any): T | undefined {
    let context: Context = this;
    let value: any;
    while (true) {
      value = context.state?.get(key);
      if (value === undefined && context.parent != null) {
        context = context.parent;
      } else {
        break;
      }
    }
    return value;
  }

  /**
   * Gets the value stored at `key` on this context.
   */
  getOwnState<T>(key: any): T | undefined {
    return this.state?.get(key);
  }

  /**
   * Stores `value` at `key` in this context's state.
   */
  setState<T>(key: any, value: T) {
    if (!this.state) this.state = new Map();
    this.state.set(key, value);
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
  catchError(callback: (error: unknown, info: ErrorInfo) => void) {
    if (this.#errorHandler) {
      this.logger.warn("Overwriting existing error handler");
    }
    this.#errorHandler = callback;
    return () => (this.#errorHandler = undefined);
  }

  bubbleError(error: unknown, chain: Context[]) {
    if (this.#errorHandler) {
      this.#errorHandler(error, this.getErrorInfo(error, [...chain, this]));
    } else if (this.parent) {
      this.parent.bubbleError(error, [...chain, this]);
    } else {
      // The top level (app) context should be attaching a handler when it mounts.
      throw error;
    }
  }

  private getErrorInfo(error: unknown, chain: Context[]): ErrorInfo {
    const contextStack = chain.reduceRight((str, ctx) => `${str}-> ${ctx.getName()} [id: ${ctx.id}]\n`, "");

    const source = chain[0];
    return {
      source: {
        id: source.id,
        name: source.getName(),
      },
      contextStack,
    };
  }
}
