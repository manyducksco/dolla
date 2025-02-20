import type { StoreConsumerContext, ComponentContext, ElementContext } from "./context.js";
import type { Logger } from "./dolla.js";
import { IS_STORE } from "./symbols.js";
import { isFunction } from "../typeChecking.js";
import { effect, EffectCallback, UnsubscribeFunction } from "./signals.js";
import { getUniqueId } from "../utils.js";

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
  effect(callback: EffectCallback): UnsubscribeFunction;
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
    return this.store.name || this.store.id;
  }

  set name(value) {
    this.store.name = value;
    this.store.logger.setName(value);
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

  effect(callback: EffectCallback) {
    const store = this.store;

    if (store.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(callback);
      store.lifecycleListeners.unmount.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFunction | undefined;
      let disposed = false;
      store.lifecycleListeners.mount.push(() => {
        if (!disposed) {
          unsubscribe = effect(callback);
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
  name;

  constructor(fn: StoreFunction<Options, Value>, options: Options) {
    this.fn = fn;
    this.name = fn.name;
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
    this.logger = elementContext.root.createLogger(this.name);
    // this._emitter.on("error", (error, eventName, ...args) => {
    //   this._logger.error({ error, eventName, args });
    //   this._logger.crash(error as Error);
    // });
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
