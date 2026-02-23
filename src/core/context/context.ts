import { assertFunction } from "../../typeChecking";
import type { Store } from "../../types";
import { IdGenerator } from "../../utils";
import {
  get,
  type Gettable,
  type Getter,
  type MaybeReadable,
  type Reactive,
  type UnsubscribeFn,
  watch,
  type WatchCallback,
} from "../reactive";
import { performInContext } from "./current.js";
import { ContextLifecycle, LifecycleEvent, LifecycleListener, LifecycleState } from "./lifecycle.js";
import { createLogger, type Logger, type LoggerOptions } from "./logger.js";

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

const contextIds = new IdGenerator();

export class Context {
  readonly id = contextIds.next();
  #name: Gettable<string>;

  lifecycle = new ContextLifecycle(this);
  logger: Logger;
  parent?: Context;
  stores?: Map<Store<any, any>, any>;
  state?: Map<any, any>;

  #errorHandler?: (error: unknown, info: ErrorInfo) => void;

  constructor(name: Reactive<string> | Getter<string> | string, options?: ContextOptions) {
    this.#name = name;

    // Wrapping the get in another getter in case this.#name changes to a different object between calls.
    this.logger = createLogger(() => get(this.#name), {
      tag: this.id,
      tagName: "id",
      onCrash: (error) => {
        this.throwError(error);
      },
    });
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

  // -------------------------- \\
  //      Lifecycle Events      \\
  // ---------------------------\\

  isMounted() {
    const { state } = this.lifecycle;
    return state >= LifecycleState.DidMount && state < LifecycleState.DidUnmount;
  }

  /**
   * Emits a lifecycle event to this context.
   */
  emit(event: LifecycleEvent) {
    this.lifecycle.emit(event);
  }

  /**
   * Registers a `listener` to be called at a specific transition point during this context's lifecycle.
   *
   * Prefer `useMount` and `useUnmount` hooks for general usage.
   */
  onLifecycleTransition(event: LifecycleEvent, listener: LifecycleListener) {
    return this.lifecycle.on(event, () => {
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

  // -------------------------- \\
  //        Context Info        \\
  // ---------------------------\\

  /**
   * Returns the current name of this context.
   */
  getName(): string {
    return get(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: Reactive<string> | Getter<string> | string) {
    this.#name = name;
  }

  // -------------------------- \\
  //     Stores (provide/use)   \\
  // ---------------------------\\

  /**
   * Creates an instance of a store and attaches it to this context.
   */
  provideStore<T>(store: Store<any, T>, options?: any): this {
    if (this.stores?.get(store)) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw new Error(`An instance of ${name} was already added on this context.`);
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
      throw new Error(`Store '${store.name}' is not provided by this context.`);
    }
    return result as T;
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
      this.lifecycle.on("didUnmount", unsubscribe);
      return unsubscribe;
    } else {
      // Prime the effect to run when the context is mounted and unsubscribe when unmounted, unless unsubscribed before `willMount`.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this.lifecycle.on("willMount", () => {
        if (!disposed) {
          unsubscribe = watch(fn);
          this.lifecycle.on("didUnmount", unsubscribe);
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

  // -------------------------- \\
  //        Context State       \\
  // ---------------------------\\

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

  // -------------------------- \\
  //      Error Propagation     \\
  // ---------------------------\\

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
