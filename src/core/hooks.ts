import { type Context, type Logger, type Store } from "../core";
import { LifecycleEventName } from "./context";
import { type EffectFn, getCurrentContext, type Getter, type MaybeGetter, untracked } from "./signal";

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
 * Sets the component name for logging purposes.
 */
export function $name(name: MaybeGetter<string>): void {
  $$context().setName(name);
}

/**
 * Returns the component's logger. Updates `name` if passed.
 */
export function $debug(name?: MaybeGetter<string>): Logger {
  const context = $$context();
  if (name) context.setName(name);
  return context.logger;
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

/**
 * Schedules `callback` to run just after the component is mounted.
 * If `callback` returns a function, that function will run when the component is unmounted.
 */
export function $setup(callback: () => void | (() => void)): void {
  const context = $$context();
  context.onLifecycleTransition("didMount", () => {
    const result = callback();
    if (result) context.onLifecycleTransition("didUnmount", result);
  });
}

/**
 * Schedules `callback` to run when the component is unmounted.
 */
export function $teardown(callback: () => void): void {
  $$context().onLifecycleTransition("didUnmount", callback);
}

/**
 * Schedules `callback` to be run on a lifecycle `event`.
 * Prefer using `$setup` and `$teardown` unless you have an advanced use case.
 */
export function $on(event: LifecycleEventName, callback: () => void): void {
  $$context().onLifecycleTransition(event, callback);
}

/**
 * Creates an effect bound to the current context.
 * The `fn` is called when the component is mounted, then again each time the dependencies are updated until the component is unmounted.
 */
export function $effect(fn: EffectFn, deps?: Getter<any>[]): void {
  if (deps) {
    $$context().effect(() => {
      for (const dep of deps) dep();
      return untracked(fn);
    });
  } else {
    $$context().effect(fn);
  }
}
