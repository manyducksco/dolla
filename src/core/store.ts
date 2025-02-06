import { Emitter } from "@manyducks.co/emitter";
import { getUniqueId } from "../utils.js";
import { ContextEvent, type ComponentContext, type ElementContext } from "./context.js";
import type { Logger } from "./dolla.js";
import { IS_STORE, IS_STORE_FACTORY } from "./symbols.js";

export type StoreFunction<Options, Value> = (this: StoreContext, options: Options, context: StoreContext) => Value;

export type StoreFactory<Options, Value> = Options extends undefined
  ? () => Store<Options, Value>
  : (options: Options) => Store<Options, Value>;

export interface StoreContext extends Logger, ComponentContext {
  /**
   * Registers a callback to run just after this store is mounted.
   */
  onMount(callback: () => void): void;

  /**
   * Registers a callback to run just after this store is unmounted.
   */
  onUnmount(callback: () => void): void;
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

  _elementContext!: ElementContext;
  _emitter = new Emitter<StoreEvents>();
  _logger!: Logger;

  constructor(key: string, fn: StoreFunction<Options, Value>, options: Options) {
    this.key = key;
    this._fn = fn;
    this._options = options;
  }

  attach(elementContext: ElementContext): void {
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
  }

  handleMount() {
    this._emitter.emit("mounted");
  }

  handleUnmount() {
    this._emitter.emit("unmounted");
    this._emitter.clear();
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
