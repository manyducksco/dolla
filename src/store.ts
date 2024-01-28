import { type AppContext, type ElementContext } from "./app.js";
import { type DebugChannel } from "./classes/DebugHub.js";
import { observe, type MaybeReadable, type ReadableValues } from "./state.js";
import { isObject, typeOf } from "./typeChecking.js";
import type { BuiltInStores } from "./types.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

export type Store<O, E> = (context: StoreContext<O>) => E | Promise<E>;

export interface StoreContext<Options = any> extends DebugChannel {
  /**
   * Returns the shared instance of `store`.
   */
  getStore<T extends Store<any, any>>(store: T): ReturnType<T>;

  /**
   * Returns the shared instance of a built-in store.
   */
  getStore<N extends keyof BuiltInStores>(name: N): BuiltInStores[N];

  /**
   * Runs `callback` after this store is connected.
   */
  onConnected(callback: () => any): void;

  /**
   * Runs `callback` after this store is disconnected.
   */
  onDisconnected(callback: () => any): void;

  /**
   * The name of this store for logging and debugging purposes.
   */
  name: string;

  /**
   * Takes an Error object, unmounts the app and displays its crash page.
   */
  crash(error: Error): void;

  /**
   * Observes a readable value while this store is connected. Calls `callback` each time the value changes.
   */
  observe<T>(state: MaybeReadable<T>, callback: (currentValue: T) => void): void;

  /**
   * Observes a set of readable values while this store is connected.
   * Calls `callback` with each value in the same order as `readables` each time any of their values change.
   */
  observe<T extends MaybeReadable<any>[]>(
    states: [...T],
    callback: (...currentValues: ReadableValues<T>) => void
  ): void;

  observe<I1, I2>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    callback: (value1: I1, value2: I2) => void
  ): void;

  observe<I1, I2, I3>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    callback: (value1: I1, value2: I2, value3: I3) => void
  ): void;

  observe<I1, I2, I3, I4>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4) => void
  ): void;

  observe<I1, I2, I3, I4, I5>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7, value8: I8) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8, I9>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    state9: MaybeReadable<I9>,
    callback: (
      value1: I1,
      value2: I2,
      value3: I3,
      value4: I4,
      value5: I5,
      value6: I6,
      value7: I7,
      value8: I8,
      value9: I9
    ) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8, I9, I10>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    state9: MaybeReadable<I9>,
    state10: MaybeReadable<I10>,
    callback: (
      value1: I1,
      value2: I2,
      value3: I3,
      value4: I4,
      value5: I5,
      value6: I6,
      value7: I7,
      value8: I8,
      value9: I9,
      value10: I10
    ) => void
  ): void;

  /**
   * Options this store was initialized with.
   */
  options: Options;
}

/*=====================================*\
||          Context Accessors          ||
\*=====================================*/

export interface StoreContextSecrets {
  appContext: AppContext;
  elementContext: ElementContext;
}

const SECRETS = Symbol("STORE_SECRETS");

export function getStoreSecrets(c: StoreContext): StoreContextSecrets {
  return (c as any)[SECRETS];
}

/*=====================================*\
||             Store Init              ||
\*=====================================*/

export function store<O>(callback: Store<any, O>) {
  return callback;
}

/**
 * Parameters passed to the makeStore function.
 */
interface StoreConfig<O> {
  store: Store<O, any>;
  appContext: AppContext;
  elementContext: ElementContext;
  options?: O;
}

export function initStore<O>(config: StoreConfig<O>) {
  const appContext = config.appContext;
  const elementContext = config.elementContext;

  let isConnected = false;

  // Lifecycle and observers
  const stopObserverCallbacks: (() => void)[] = [];
  const connectedCallbacks: (() => any)[] = [];
  const disconnectedCallbacks: (() => any)[] = [];

  const ctx: Omit<StoreContext, keyof DebugChannel> = {
    name: config.store.name ?? "anonymous",
    options: config.options,

    getStore(store: keyof BuiltInStores | Store<any, any>) {
      let name: string;

      if (typeof store === "string") {
        name = store as keyof BuiltInStores;
      } else {
        name = store.name;
      }

      if (typeof store !== "string") {
        let ec: ElementContext | undefined = elementContext;
        while (ec) {
          if (ec.stores.has(store)) {
            return ec.stores.get(store)?.instance!.exports;
          }
          ec = ec.parent;
        }
      }

      if (appContext.stores.has(store)) {
        const _store = appContext.stores.get(store)!;

        if (!_store.instance) {
          appContext.crashCollector.crash({
            componentName: ctx.name,
            error: new Error(
              `Store '${name}' was accessed before it was set up. Make sure '${name}' is registered before components that access it.`
            ),
          });
        }

        return _store.instance!.exports;
      }

      appContext.crashCollector.crash({
        componentName: ctx.name,
        error: new Error(`Store '${name}' is not registered on this app.`),
      });
    },

    onConnected(callback: () => any) {
      connectedCallbacks.push(callback);
    },

    onDisconnected(callback: () => any) {
      disconnectedCallbacks.push(callback);
    },

    crash(error: Error) {
      config.appContext.crashCollector.crash({ error, componentName: ctx.name });
    },

    observe(...args: any[]) {
      const callback = args.pop();
      const readables = args.flat();
      if (isConnected) {
        // If called when the component is connected, we assume this code is in a lifecycle hook
        // where it will be triggered at some point again after the component is reconnected.
        const stop = observe(readables, callback);
        stopObserverCallbacks.push(stop);
      } else {
        // This should only happen if called in the body of the component function.
        // This code is not always re-run between when a component is disconnected and reconnected.
        connectedCallbacks.push(() => {
          const stop = observe(readables, callback);
          stopObserverCallbacks.push(stop);
        });
      }
    },
  };

  const debugChannel = appContext.debugHub.channel({
    get name() {
      return ctx.name;
    },
  });

  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(debugChannel));

  Object.defineProperty(ctx, SECRETS, {
    enumerable: false,
    configurable: false,
    value: {
      appContext,
      elementContext,
    } as StoreContextSecrets,
  });

  let exports: any;

  return {
    get name() {
      return ctx.name;
    },

    get exports() {
      return exports;
    },

    setup() {
      let result: unknown;

      try {
        result = config.store(ctx as StoreContext<O>);
      } catch (error) {
        if (error instanceof Error) {
          appContext.crashCollector.crash({ error, componentName: ctx.name });
        } else {
          throw error;
        }
      }

      if (result instanceof Promise) {
        appContext.crashCollector.crash({
          error: new TypeError(`Store function cannot return a Promise`),
          componentName: ctx.name,
        });
      }

      if (!isObject(result)) {
        const error = new TypeError(`Expected ${ctx.name} function to return an object. Got: ${typeOf(result)}`);
        appContext.crashCollector.crash({ error, componentName: ctx.name });
      }

      exports = result;
    },

    connect() {
      while (connectedCallbacks.length > 0) {
        const callback = connectedCallbacks.shift()!;
        callback();
      }
    },

    disconnect() {
      while (disconnectedCallbacks.length > 0) {
        const callback = disconnectedCallbacks.shift()!;
        callback();
      }
    },
  };
}
