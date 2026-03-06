import { createLogger, type Store } from "../core";
import { isFunction, isPromise } from "../typeChecking";
import type { Context } from "./context.js";
import { getCurrentContext } from "./context.js";
import { type MaybeGetter, effect, type EffectCallback } from "./reactive";

/**
 * Returns the component's Context object. Prefer using standard hooks unless you have an advanced use case.
 */
export function $$context(): Context {
  const context = getCurrentContext();
  if (!context) {
    throw new Error(`No context found; hooks can only be called in the body of a View, Store or Mixin.`);
  }
  return context;
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
  const context = $$context();
  return createLogger(typeof name === "function" ? () => name(context.getName()) : () => context.getName(), {
    tag: context.id,
    tagName: "ctx",
  });
}

/**
 * Adds a store to this context and returns the store instance.
 */
export function $provide<Value, Options>(store: Store<Options, Value>, options?: Options): Value;

/**
 * Sets a value on this context, making it available to child components.
 */
export function $provide<Value>(key: string | symbol, value: Value): Value;

export function $provide<Value, Options>(...args: any[]): Value {
  const context = $$context();
  if (typeof args[0] === "function") {
    const [store, options] = args as [Store<Options, Value>, options?: Options];
    return context.provideStore(store, options);
  } else {
    const [key, value] = args as [string | symbol, Value];
    context.state[key] = value;
    return value;
  }
}

/**
 * Returns the nearest instance of a Store.
 */
export function $use<T>(store: Store<any, T>): T;

export function $use<T>(key: string | symbol, fallback: T): T | undefined;

export function $use<T>(key: string | symbol, fallback?: T): T | undefined;

export function $use<T>(arg: Store<any, T> | string | symbol, fallback?: T) {
  const context = $$context();
  if (typeof arg === "function") {
    return context.getStore(arg);
  } else {
    return context.state[arg] ?? fallback;
  }
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
  const context = $$context();

  context.onMount(() => {
    const controller = new AbortController();
    const result = callback(controller.signal);
    if (isPromise(result)) {
      context.onUnmount(() => {
        controller.abort();
      });
      result.then((callback) => {
        if (!controller.signal.aborted && typeof callback === "function") {
          context.onUnmount(callback);
        }
      });
    } else if (isFunction(result)) {
      context.onUnmount(result);
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
  const context = $$context();

  const setupEffect = () => {
    const unsubscribe = effect(callback);
    context.onUnmount(unsubscribe);
  };

  if (context.isMounted) {
    setupEffect();
  } else {
    context.onMount(setupEffect);
  }
}
