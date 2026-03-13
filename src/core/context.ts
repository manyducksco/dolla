import { Store } from "../types";
import { assert, isFunction, isObject } from "../utils";
import { effect } from "./signals";

const EXPECTED_CONTEXT = "Expected a Context object.";

export type LifecycleListener = () => any;

type BaseContextState = {
  isMounted: boolean;
};

export type Context<T = Record<string | symbol, any>> = BaseContextState & T;

/*===================================*\
||              Context              ||
\*===================================*/

const MOUNT_LISTENERS = Symbol("Context.mountListeners");
const CLEANUP_LISTENERS = Symbol("Context.cleanupListeners");

export function createContext(parent?: Context): Context {
  return Object.assign(Object.create(parent ?? null), { isMounted: false });
}

export function mountContext(context: Context) {
  if (context.isMounted) return;
  context.isMounted = true;
  // resumeContext(context);
  _callListeners(context, MOUNT_LISTENERS);
}

export function unmountContext(context: Context) {
  if (!context.isMounted) return;
  context.isMounted = false;
  _callListeners(context, CLEANUP_LISTENERS);
}

export function onMount(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, MOUNT_LISTENERS)) context[MOUNT_LISTENERS] = [fn];
  else context[MOUNT_LISTENERS].push(fn);
}

export function onCleanup(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, CLEANUP_LISTENERS)) context[CLEANUP_LISTENERS] = [fn];
  else context[CLEANUP_LISTENERS].push(fn);
}

export function onEffect(context: Context, fn: () => void) {
  assert(isObject, EXPECTED_CONTEXT);

  if (context.isMounted) {
    onCleanup(context, effect(fn));
  } else {
    onMount(context, () => {
      onCleanup(context, effect(fn));
    });
  }
}

function _callListeners(context: Context, key: symbol) {
  if (Object.hasOwn(context, key)) {
    for (const callback of context[key]) {
      callback();
    }
    context[key].length = 0;
  }
}

/*===================================*\
||     Stores: Provide & Inject      ||
\*===================================*/

export const STORE_ID = Symbol("Dolla.StoreId");

export function provide<Options, Returns>(
  context: Context,
  store: Store<Options, Returns> & { [STORE_ID]?: symbol },
  ...args: undefined extends Options ? [options?: Options] : [options: Options]
) {
  assert(isFunction(store), "Store must be a function.");

  // Tag the store function with a unique symbol if it doesn't have one.
  if (!store[STORE_ID]) store[STORE_ID] = Symbol(store.name);

  if (Object.hasOwn(context, store[STORE_ID])) {
    throw new Error("Store was already provided on this context.");
  }

  // Give the store its own context bound to this lifecycle.
  const storeContext = createContext(context);
  onMount(context, () => mountContext(storeContext));
  onCleanup(context, () => unmountContext(storeContext));
  storeContext.name = store.name;

  return (context[store[STORE_ID]!] = store.call(storeContext, args[0] as Options, storeContext));
}

export function inject<Returns>(context: Context, store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  assert(isFunction(store), "Store must be a function.");

  const id = store[STORE_ID];
  const result = id ? context[id] : undefined;
  if (result == null) {
    throw new Error(`Store '${store.name}' is not provided by this context.`);
  }
  return result;
}
