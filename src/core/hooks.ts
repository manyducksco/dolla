import { type Store } from "../core";
import { isFunction, isPromise } from "../typeChecking";
import { type Context, type ErrorInfo, getCurrentContext, type LifecycleEvent } from "./context";
import { type Getter, type Reactive, type WatchCallback } from "./reactive";

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
export function $name(name: Reactive<string> | Getter<string> | string): void {
  $$context().setName(name);
}

/**
 * Returns the component's logger.
 */
export function $debug() {
  return $$context().logger;
}

/**
 * Adds a store to this context and returns the store instance.
 */
export function $provide<Value, Options>(store: Store<Options, Value>, options?: Options): Value {
  return $$context().provideStore(store, options).useStore(store);
}

/**
 * Returns the nearest instance of a Store.
 */
export function $use<T>(store: Store<any, T>): T {
  return $$context().useStore(store);
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
 * If the promies resolves to a function, that function will run when the component is unmounted.
 */
export function $setup(callback: AsyncSetupCallback): void;

export function $setup(callback: SetupCallback | AsyncSetupCallback): void {
  const context = $$context();

  const controller = new AbortController();
  context.onLifecycleTransition("didUnmount", () => {
    controller.abort();
  });

  context.onLifecycleTransition("didMount", () => {
    const result = callback(controller.signal);
    if (isPromise(result)) {
      result.then((callback) => {
        if (!controller.signal.aborted && typeof callback === "function") {
          context.onLifecycleTransition("didUnmount", callback);
        }
      });
    } else if (isFunction(result)) {
      context.onLifecycleTransition("didUnmount", result);
    }
  });
}

/**
 * Schedules `callback` to run when the component is unmounted.
 */
export function $teardown(callback: () => void | Promise<void>): void {
  $$context().onLifecycleTransition("didUnmount", callback);
}

/**
 * Schedules `callback` to be run on a lifecycle `event`.
 * Prefer using `$setup` and `$teardown` unless you have an advanced use case.
 */
export function $on(event: LifecycleEvent, callback: () => void): void {
  $$context().onLifecycleTransition(event, callback);
}

/**
 * Runs `callback` when component mounts, then again each time one of its tracked values changes.
 * The watcher will be cleaned up automatically when the component unmounts.
 */
export function $watch(callback: WatchCallback): void {
  $$context().watch(callback);
}

/**
 * Catches errors thrown in child components, including in event handlers and lifecycle hooks.
 */
export function $catch(callback: (error: unknown, info: ErrorInfo) => void) {
  $$context().catchError(callback);
}
