import type { Store } from "../types.js";
import { assertTypeOf, isFunction, isPromise } from "../utils.js";
import {
  callInContext,
  Context,
  createContext,
  getActiveContext,
  mountContext,
  onMount,
  onUnmount,
  unmountContext,
} from "./context.js";
import { Debug } from "../debug/debug.js";
import { effect, peek, type EffectFn, type Getter, type UnsubscribeFn } from "./signals.js";

/**
 * Returns the active Context object. Prefer using standard hooks unless you have an advanced use case.
 */
export function $$context(): Context {
  const self = getActiveContext();
  if (!self) {
    throw new Error(`No context found; hooks can only be called in the body of a View, Store or Mixin.`);
  }
  return self;
}

/**
 * Sets the context name for logging purposes.
 */
export function $name(name: Getter<string> | string): void {
  $$context().name = peek(name);
}

export const STORE_ID = Symbol("Dolla.StoreId");

/**
 * Adds a store to this context and returns the store instance.
 */
export function $provide<Returns, Options>(
  store: Store<Options, Returns> & { [STORE_ID]?: symbol },
  options?: Options,
): Returns {
  const self = $$context();

  assertTypeOf(store, isFunction, "Expected a store function. Got: %t");

  // Tag the store function with a unique symbol if it doesn't have one.
  if (!store[STORE_ID]) store[STORE_ID] = Symbol(store.name);

  if (self.hasOwnProperty(store[STORE_ID])) {
    let name = store.name ? `'${store.name}'` : "this store";
    throw new Error(`An instance of ${name} was already provided on this context.`);
  }

  // Give the store its own context bound to this lifecycle.
  const context = createContext(store.name, self);
  onMount(self, () => mountContext(context));
  onUnmount(self, () => unmountContext(context));

  callInContext(context, () => {
    self[store[STORE_ID]!] = store.call(context, options as any);
  });

  return self[store[STORE_ID]];
}

/**
 * Returns the nearest instance of a Store.
 */
export function $use<Returns>(store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  const self = $$context();

  assertTypeOf(store, isFunction, "Expected a store function. Got: %t");

  const id = store[STORE_ID];
  const result = id ? self[id] : undefined;
  if (result == null) {
    throw new Error(`Store '${store.name}' is not provided by this context.`);
  }
  return result;
}

export type CleanupFnOrVoid = void | (() => void);
export type SetupCallback = (signal: AbortSignal) => CleanupFnOrVoid;
export type AsyncSetupCallback = (signal: AbortSignal) => Promise<CleanupFnOrVoid>;

/**
 * Schedules `callback` to run just after the component is mounted.
 * If `callback` returns a function, that function will run when the component is unmounted.
 */
export function $setup(callback: SetupCallback): void;

/**
 * Schedules `callback` to run just after the component is mounted.
 * The callback receives an `AbortSignal` that will abort if the component unmounts before the promise resolves.
 * Can return a cleanup function. Cleanup function will not be run if using an async callback and the signal aborts before the promise resolves.
 */
export function $setup(callback: AsyncSetupCallback): void;

export function $setup(callback: SetupCallback | AsyncSetupCallback): void {
  const self = $$context();

  onMount(self, () => {
    const controller = new AbortController();
    const result = callback(controller.signal);
    if (isPromise(result)) {
      onUnmount(self, () => {
        controller.abort();
      });
      result.then((callback) => {
        if (!controller.signal.aborted && typeof callback === "function") {
          onUnmount(self, callback);
        }
      });
    } else if (isFunction(result)) {
      onUnmount(self, result);
    }
  });
}

/**
 * Schedules `callback` to run when the component is unmounted.
 */
export function $teardown(callback: () => void | Promise<void>): void {
  onUnmount($$context(), callback);
}

/**
 * Creates an effect that is bound to the active context.
 * This effect will be automatically cleaned up when the component is unmounted.
 */
export function $effect(callback: EffectFn): UnsubscribeFn {
  const context = $$context();
  return effect(callback, { context });
}
