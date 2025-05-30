import { isFunction } from "../typeChecking.js";
import { getUniqueId } from "../utils.js";
import {
  rootElementContext,
  type ComponentContext,
  type ElementContext,
  type StoreConsumerContext,
  type StoreProviderContext,
} from "./context.js";
import { createLogger, type Logger } from "./logger.js";
import { $, effect, peek, type EffectFn, type UnsubscribeFn } from "./signals.js";
import { IS_STORE } from "./symbols.js";

export type StoreFunction<Options, Value> = (this: StoreContext, options: Options, context: StoreContext) => Value;

export type StoreFactory<Options, Value> = Options extends undefined
  ? () => Store<Options, Value>
  : (options: Options) => Store<Options, Value>;

export interface StoreContext extends Omit<Logger, "setName">, ComponentContext, StoreConsumerContext {
  /**
   * True while this store is attached to a context that is currently mounted in the view tree.
   */
  readonly isMounted: boolean;

  /**
   * Registers a callback to run just after this store is mounted.
   */
  onMount(callback: () => void): void;

  /**
   * Registers a callback to run just after this store is unmounted.
   */
  onUnmount(callback: () => void): void;

  /**
   * Passes a getter function to `callback` that will track reactive states and return their current values.
   * Callback will be run each time a tracked state gets a new value.
   */
  effect(callback: EffectFn): UnsubscribeFn;
}

interface Context<Options, Value> extends Omit<Logger, "setName"> {}

class Context<Options, Value> implements StoreContext, StoreConsumerContext {
  private store;

  constructor(store: Store<Options, Value>) {
    this.store = store;

    // Copy logger methods from logger.
    const descriptors = Object.getOwnPropertyDescriptors(this.store.logger);
    for (const key in descriptors) {
      if (key !== "setName") {
        Object.defineProperty(this, key, descriptors[key]);
      }
    }
  }

  get isMounted() {
    return this.store.isMounted;
  }

  get name() {
    return peek(this.store.name) || this.store.id;
  }

  set name(value) {
    this.store.name(value);
  }

  get<Value>(store: StoreFunction<any, Value>): Value {
    if (isFunction(store)) {
      let context = this.store.elementContext;
      let instance: Store<any, Value> | undefined;
      while (true) {
        instance = context.stores.get(store);
        if (instance == null && context.parent != null) {
          context = context.parent;
        } else {
          break;
        }
      }
      if (instance == null) {
        throw new StoreError(`Store '${store.name}' is not provided on this context.`);
      } else {
        return instance.value;
      }
    } else {
      throw new StoreError(`Invalid store.`);
    }
  }

  onMount(callback: () => void): void {
    this.store.lifecycleListeners.mount.push(callback);
  }

  onUnmount(callback: () => void): void {
    this.store.lifecycleListeners.unmount.push(callback);
  }

  effect(callback: EffectFn) {
    const store = this.store;

    const fn = () => {
      try {
        // Return callback so cleanup function passes through
        return callback();
      } catch (error) {
        if (error instanceof Error) {
          this.crash(error);
        } else if (typeof error === "string") {
          this.crash(new Error(error));
        } else {
          this.error(error);
          this.crash(new Error(`Unknown error thrown in effect callback`));
        }
      }
    };

    if (store.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(fn);
      store.lifecycleListeners.unmount.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      store.lifecycleListeners.mount.push(() => {
        if (!disposed) {
          unsubscribe = effect(fn);
          store.lifecycleListeners.unmount.push(unsubscribe);
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
}

export class Store<Options, Value> {
  readonly fn;
  private _options;

  /**
   * Value is guaranteed to be set after `attach` is called.
   */
  value!: Value;

  isMounted = false;

  elementContext!: ElementContext;

  lifecycleListeners: {
    mount: (() => any)[];
    unmount: (() => any)[];
  } = { mount: [], unmount: [] };

  logger!: Logger;
  id = getUniqueId();
  name = $("");

  constructor(fn: StoreFunction<Options, Value>, options: Options) {
    this.fn = fn;
    this.name(fn.name);
    this._options = options;
  }

  /**
   * Attaches this Store to the elementContext.
   * Returns false if there was already an instance attached, and true otherwise.
   */
  attach(elementContext: ElementContext): boolean {
    if (elementContext.stores.has(this.fn)) {
      return false;
    }
    this.elementContext = elementContext;
    this.logger = createLogger(this.name, { uid: this.id });
    const context = new Context(this);
    try {
      this.value = this.fn.call(context, this._options, context);
    } catch (error) {
      this.logger.crash(error as Error);
      throw error;
    }
    elementContext.stores.set(this.fn, this);
    return true;
  }

  handleMount() {
    this.isMounted = true;

    for (const listener of this.lifecycleListeners.mount) {
      listener();
    }
    this.lifecycleListeners.mount.length = 0;
  }

  handleUnmount() {
    this.isMounted = false;

    for (const listener of this.lifecycleListeners.unmount) {
      listener();
    }
    this.lifecycleListeners.unmount.length = 0;
  }
}

export function isStore<Options, Value>(value: any): value is Store<Options, Value> {
  return value?.[IS_STORE] === true;
}

export class StoreError extends Error {}

export type Stores = StoreProviderContext & StoreConsumerContext;

/**
 * Global store registry.
 */
export const Stores: Stores = Object.freeze({
  provide(store: any, options?: any) {
    const instance = new Store(store, options!);
    const attached = instance.attach(rootElementContext);
    if (!attached) {
      let name = store.name ? `'${store.name}'` : "this store";
      console.warn(`An instance of ${name} is already attached.`);
      return this.get(store);
    } else {
      return instance.value;
    }
  },
  get<T>(store: any): T {
    if (isFunction(store)) {
      const instance = rootElementContext.stores.get(store);
      if (instance == null) {
        let name = store.name ? `'${store.name}'` : "this store";
        throw new StoreError(`No instance of ${name} is provided.`);
      } else {
        return instance.value;
      }
    } else {
      throw new StoreError(`Invalid store.`);
    }
  },
});
