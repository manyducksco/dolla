import { Emitter } from "@manyducks.co/emitter";
import { getUniqueId } from "../utils.js";
import { ContextEvent, type ComponentContext, type ElementContext } from "./context.js";
import type { Logger } from "./dolla.js";
import { IS_STORE, IS_STORE_FACTORY } from "./symbols.js";
import { createWatcher, type MaybeState, type StateValues, type StopFunction } from "./state.js";

export type StoreFunction<Options, Value> = (this: StoreContext, options: Options, context: StoreContext) => Value;

export type StoreFactory<Options, Value> = Options extends undefined
  ? () => Store<Options, Value>
  : (options: Options) => Store<Options, Value>;

export interface StoreContext extends Logger, ComponentContext {
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
}

interface Context<Options, Value> extends Logger {}

class Context<Options, Value> implements StoreContext {
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

  setName(name: string): StoreContext {
    this.__store._logger.setName(name);
    return this;
  }

  set<T>(key: string | symbol, value: T): T {
    this.__store._elementContext.data[key] = value;
    return value;
  }

  get<T>(key: string | symbol): T | null {
    let ctx = this.__store._elementContext;

    while (true) {
      if (key in ctx.data) {
        return ctx.data[key] as T;
      } else if (ctx.parent) {
        ctx = ctx.parent;
      } else {
        break;
      }
    }

    return null;
  }

  on<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    this.__store._elementContext.emitter.on(eventName, listener);
  }

  off<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    this.__store._elementContext.emitter.off(eventName, listener);
  }

  once<T = unknown>(eventName: string, listener: (event: ContextEvent<T>) => void): void {
    this.__store._elementContext.emitter.once(eventName, listener);
  }

  emit<T = unknown>(eventName: string, detail: T): boolean {
    return this.__store._elementContext.emitter.emit(eventName, new ContextEvent(eventName, detail));
  }

  onMount(callback: () => void): void {
    this.__store._emitter.on("mounted", callback);
  }

  onUnmount(callback: () => void): void {
    this.__store._emitter.on("unmounted", callback);
  }

  watch<T extends MaybeState<any>[]>(states: [...T], callback: (...values: StateValues<T>) => void): StopFunction {
    const view = this.__store;

    if (view.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      return view._watcher.watch(states, callback);
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let stop: StopFunction | undefined;
      let isStopped = false;
      view._emitter.on("mounted", () => {
        if (!isStopped) {
          stop = view._watcher.watch(states, callback);
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
}

type StoreEvents = {
  mounted: [];
  unmounted: [];
};

export class Store<Options, Value> {
  readonly key;

  private _fn;
  private _options;

  /**
   * Value is guaranteed to be set after `attach` is called.
   */
  value!: Value;

  isMounted = false;

  _elementContext!: ElementContext;
  _emitter = new Emitter<StoreEvents>();
  _logger!: Logger;
  _watcher = createWatcher();

  get name() {
    return this._fn.name;
  }

  constructor(key: string, fn: StoreFunction<Options, Value>, options: Options) {
    this.key = key;
    this._fn = fn;
    this._options = options;
  }

  /**
   * Attaches this Store to the elementContext.
   * Returns false if there was already an instance attached, and true otherwise.
   */
  attach(elementContext: ElementContext): boolean {
    if (elementContext.stores.has(this.key)) {
      return false;
    }
    this._elementContext = elementContext;
    this._logger = elementContext.root.createLogger(this._fn.name);
    this._emitter.on("error", (error, eventName, ...args) => {
      console.log({ error, eventName, args });
      this._logger.crash(error as Error);
    });
    const context = new Context(this);
    try {
      this.value = this._fn.call(context, this._options, context);
    } catch (error) {
      this._logger.crash(error as Error);
    }
    elementContext.stores.set(this.key, this);
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
  }
}

export function isStoreFactory<Options, Value>(value: any): value is StoreFactory<Options, Value> {
  return value?.[IS_STORE_FACTORY] === true;
}

export function isStore<Options, Value>(value: any): value is Store<Options, Value> {
  return value?.[IS_STORE] === true;
}

/**
 * Defines a new store.
 */
export function createStore<Options = undefined, Value = unknown>(
  fn: StoreFunction<Options, Value>,
): StoreFactory<Options, Value> {
  const key = getUniqueId();
  function factory(options?: any) {
    return new Store(key, fn, options);
  }
  factory[IS_STORE_FACTORY] = true;
  factory.key = key;
  return factory as any;
}

export class StoreError extends Error {}
