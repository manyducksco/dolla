import { createLogger, type Store } from "../core";
import { assertTypeOf, isFunction, isPromise } from "../typeChecking";
import type { Context } from "./context.js";
import { contextualize, getCurrentContext } from "./context.js";
import { effect, type EffectCallback, type MaybeGetter } from "./reactive";

/**
 * Returns the component's Context object. Prefer using standard hooks unless you have an advanced use case.
 */
export function $$context(): Context {
  const self = getCurrentContext();
  if (!self) {
    throw new Error(`No context found; hooks can only be called in the body of a View, Store or Mixin.`);
  }
  return self;
}

/**
 * Sets the context name for logging purposes.
 */
export function $name(name: MaybeGetter<string>): void {
  $$context().setName(name);
}

/**
 * Returns the component's logger.
 */
export function $debug(name?: string | ((contextName: string) => string)) {
  const self = $$context();
  return createLogger(typeof name === "function" ? () => name(self.getName()) : () => self.getName(), {
    tag: self.id,
    tagName: "ctx",
  });
}

const STORE_ID = Symbol("Dolla.StoreId");

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

  if (self.state.hasOwnProperty(store[STORE_ID])) {
    let name = store.name ? `'${store.name}'` : "this store";
    throw new Error(`An instance of ${name} was already provided on this context.`);
  }

  // Give the store its own context bound to this lifecycle.
  const context = self.createChild(store.name);
  self.onMount(context.mount.bind(context));
  self.onUnmount(context.unmount.bind(context));

  contextualize(context, () => {
    self.state[store[STORE_ID]!] = store(options as any);
  });

  return self.state[store[STORE_ID]];
}

/**
 * Returns the nearest instance of a Store.
 */
export function $use<Returns>(store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  const self = $$context();

  assertTypeOf(store, isFunction, "Expected a store function. Got: %t");

  const id = store[STORE_ID];
  const result = id ? self.state[id] : undefined;
  if (result == null) {
    throw new Error(`Store '${store.name}' is not provided by this context.`);
  }
  return result;
}

type CleanupFnOrVoid = void | (() => void);
type SetupCallback = (signal: AbortSignal) => CleanupFnOrVoid;
type AsyncSetupCallback = (signal: AbortSignal) => Promise<CleanupFnOrVoid>;

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

  self.onMount(() => {
    const controller = new AbortController();
    const result = callback(controller.signal);
    if (isPromise(result)) {
      self.onUnmount(() => {
        controller.abort();
      });
      result.then((callback) => {
        if (!controller.signal.aborted && typeof callback === "function") {
          self.onUnmount(callback);
        }
      });
    } else if (isFunction(result)) {
      self.onUnmount(result);
    }
  });
}

/**
 * Schedules `callback` to run when the component is unmounted.
 */
export function $teardown(callback: () => void | Promise<void>): void {
  $$context().onUnmount(callback);
}

/**
 * Runs `callback` when component mounts, then again each time one of its tracked values changes.
 * The watcher will be cleaned up automatically when the component unmounts.
 */
export function $effect(callback: EffectCallback) {
  const self = $$context();

  const setupEffect = () => {
    const unsubscribe = effect(callback);
    self.onUnmount(unsubscribe);
  };

  if (self.isMounted) {
    setupEffect();
  } else {
    self.onMount(setupEffect);
  }
}
