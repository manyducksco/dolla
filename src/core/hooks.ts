import { type Logger, type Store } from "../core";
import { type Context, type LifecycleEventName } from "./context";
import { I18N, type I18n } from "./i18n";
import { getLogFilter, getLogLevel, LogLevel, setLogFilter, setLogLevel } from "./logger";
import { VIEW_PRELOAD_CALLBACK, VIEW_TRANSITIONS_CONFIG } from "./nodes/view";
import { type RoutePreloadFn, ROUTER, type RouterAPI, type RouteTransitions } from "./router";
import { type WatchCallback, getCurrentContext, type MaybeReadable, type Readable, type Getter } from "./signal";

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
export function $name(name: Readable<string> | Getter<string> | string): void {
  $$context().setName(name);
}

export interface DebugHook {
  (name?: Readable<string> | Getter<string> | string): Logger;

  level: LogLevel;
  filter: string | RegExp | ((value: string) => boolean);
}

function createDebugHook(): DebugHook {
  function $debug(name?: Readable<string> | Getter<string> | string) {
    const context = $$context();
    if (name) context.setName(name);
    return context.logger;
  }

  Object.defineProperties($debug, {
    level: {
      get: getLogLevel,
      set: setLogLevel,
    },
    filter: {
      get: getLogFilter,
      set: setLogFilter,
    },
  });

  return $debug as DebugHook;
}

/**
 * Returns the component's logger. Updates `name` if passed.
 */
export const $debug = createDebugHook();

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

export function $state() {
  const context = $$context();
  return {
    get: context.getState.bind(context),
    set: context.setState.bind(context),
  };
}

/**
 * Runs `callback` when component mounts, then again each time one of its tracked values changes.
 * The watcher will be cleaned up automatically when the component unmounts.
 */
export function $watch(callback: WatchCallback): void {
  $$context().watch(callback);
}

/*=============================*\
||           Router            ||
\*=============================*/

export function $navigate() {
  return $$context().getState<RouterAPI>(ROUTER).navigate;
}

export function $route() {
  const router = $$context().getState<RouterAPI>(ROUTER);
  return {
    pattern: router.pattern,
    path: router.path,
    params: router.params,
    query: router.query,
    data: router.data,
  };
}

export function $preload(loader: RoutePreloadFn) {
  $$context().setState(VIEW_PRELOAD_CALLBACK, loader);

  // Wait for `loader` to resolve before navigating to this route.
  // No effect unless this view is mounted as a route.
}

export function $transition(config: RouteTransitions) {
  $$context().setState(VIEW_TRANSITIONS_CONFIG, config);

  // Starts after preload ends.
  // TODO: On transition in; mount this route, but suspend previous route's unmount until controller.next() is called.
  // TODO: On transition out; mount next route, but suspend this route's unmount until controller.next() is called.
}

/*=============================*\
||            i18n             ||
\*=============================*/

export function $i18n() {
  return $$context().getState<I18n>(I18N);
}
