import { Emitter } from "@manyducks.co/emitter";
import {
  ContextEvent,
  GenericEvents,
  StoreConsumerContext,
  type ComponentContext,
  type ElementContext,
  type WildcardListenerMap,
} from "./context.js";
import type { Logger } from "./dolla.js";
import { createWatcher, type MaybeState, type StateValues, type StopFunction } from "./state.js";
import { IS_STORE } from "./symbols.js";
import { isFunction } from "../typeChecking.js";
import { compose, EffectCallback, UnsubscribeFunction } from "./reactive.js";
import { getUniqueId, noOp } from "../utils.js";

export type StoreFunction<Options, Value> = (this: StoreContext, options: Options, context: StoreContext) => Value;

export type StoreFactory<Options, Value> = Options extends undefined
  ? () => Store<Options, Value>
  : (options: Options) => Store<Options, Value>;

export interface StoreContext<Events extends GenericEvents = GenericEvents>
  extends Omit<Logger, "setName">,
    ComponentContext<Events>,
    StoreConsumerContext {
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
   * Watch a set of states. The callback is called when any of the states receive a new value.
   * Watchers will be automatically stopped when this store is unmounted.
   */
  watch<T extends MaybeState<any>[]>(states: [...T], callback: (...values: StateValues<T>) => void): StopFunction;

  /**
   * Passes a getter function to `callback` that will track reactive states and return their current values.
   * Callback will be run each time a tracked state gets a new value.
   */
  effect(callback: EffectCallback): UnsubscribeFunction;
}

interface Context<Options, Value, Events extends GenericEvents> extends Omit<Logger, "setName"> {}

class Context<Options, Value, Events extends GenericEvents> implements StoreContext<Events>, StoreConsumerContext {
  __store;

  constructor(store: Store<Options, Value>) {
    this.__store = store;

    // Copy logger methods from logger.
    const descriptors = Object.getOwnPropertyDescriptors(this.__store._logger);
    for (const key in descriptors) {
      if (key !== "setName") {
        Object.defineProperty(this, key, descriptors[key]);
      }
    }
  }

  get isMounted() {
    return this.__store.isMounted;
  }

  get name() {
    return this.__store._name;
  }

  set name(value) {
    this.__store._name = value;
    this.__store._logger.setName(value);
  }

  on(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = (_type: any, event: ContextEvent, ...args: any[]) => {
        listener(event, ...args);
      };
      this.__store._elementContext.emitter.on(type, wrappedListener);
      this.__store._wildcardListeners.set(listener, wrappedListener);
    } else {
      this.__store._elementContext.emitter.on(type, listener);
    }
  }

  off(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = this.__store._wildcardListeners.get(listener);
      if (wrappedListener) {
        this.__store._elementContext.emitter.off(type, wrappedListener);
        this.__store._wildcardListeners.delete(listener);
      }
    } else {
      this.__store._elementContext.emitter.off(type, listener);
    }
  }

  once(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = (_type: any, event: ContextEvent, ...args: any[]) => {
        this.__store._wildcardListeners.delete(listener);
        listener(event, ...args);
      };
      this.__store._elementContext.emitter.once(type, wrappedListener);
      this.__store._wildcardListeners.set(listener, wrappedListener);
    } else {
      this.__store._elementContext.emitter.once(type, listener);
    }
  }

  emit<T extends keyof Events>(type: T, ...args: Events[T]): boolean {
    return this.__store._elementContext.emitter.emit(type, new ContextEvent(type as string), ...args);
  }

  get<Value>(store: StoreFunction<any, Value>): Value {
    if (isFunction(store)) {
      let context = this.__store._elementContext;
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
    this.__store._emitter.on("mounted", callback);
  }

  onUnmount(callback: () => void): void {
    this.__store._emitter.on("unmounted", callback);
  }

  watch<T extends MaybeState<any>[]>(states: [...T], callback: (...values: StateValues<T>) => void): StopFunction {
    const store = this.__store;

    if (store.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      return store._watcher.watch(states, callback);
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let stop: StopFunction | undefined;
      let isStopped = false;
      store._emitter.on("mounted", () => {
        if (!isStopped) {
          stop = store._watcher.watch(states, callback);
        }
      });
      return () => {
        if (stop != null) {
          isStopped = true;
          stop();
        }
      };
    }
  }

  effect(callback: EffectCallback) {
    const store = this.__store;

    // TODO: Set up effect in a more direct way? I'm just hacking compose here.

    if (store.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = compose<void>(callback).subscribe(noOp);
      store._unsubscribes.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFunction | undefined;
      let disposed = false;
      store._emitter.on("mounted", () => {
        if (!disposed) {
          unsubscribe = compose<void>(callback).subscribe(noOp);
          store._unsubscribes.push(unsubscribe);
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

type StoreEvents = {
  mounted: [];
  unmounted: [];
};

export class Store<Options, Value> {
  readonly fn;
  private _options;

  /**
   * Value is guaranteed to be set after `attach` is called.
   */
  value!: Value;

  isMounted = false;

  _elementContext!: ElementContext;
  _emitter = new Emitter<StoreEvents>();
  _wildcardListeners: WildcardListenerMap = new Map();
  _logger!: Logger;
  _watcher = createWatcher();
  _unsubscribes: UnsubscribeFunction[] = [];
  _name;
  _id = getUniqueId();

  get name() {
    return this._name || this._id;
  }

  constructor(fn: StoreFunction<Options, Value>, options: Options) {
    this.fn = fn;
    this._name = fn.name;
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
    this._elementContext = elementContext;
    this._logger = elementContext.root.createLogger(this._name);
    this._emitter.on("error", (error, eventName, ...args) => {
      this._logger.error({ error, eventName, args });
      this._logger.crash(error as Error);
    });
    const context = new Context(this);
    try {
      this.value = this.fn.call(context, this._options, context);
    } catch (error) {
      this._logger.crash(error as Error);
      throw error;
    }
    elementContext.stores.set(this.fn, this);
    return true;
  }

  handleMount() {
    this.isMounted = true;
    this._emitter.emit("mounted");
  }

  handleUnmount() {
    this.isMounted = false;
    this._emitter.emit("unmounted");
    this._emitter.clear();
    this._watcher.stopAll();

    for (const unsubscribe of this._unsubscribes) {
      unsubscribe();
    }
    this._unsubscribes.length = 0;
  }
}

export function isStore<Options, Value>(value: any): value is Store<Options, Value> {
  return value?.[IS_STORE] === true;
}

export class StoreError extends Error {}
