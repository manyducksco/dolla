import type { Store } from "../types.js";
import { assert } from "../utils.js";
import { createEffect } from "./signals.js";

export type LifecycleListener = () => any;

type ContextState = {
  isMounted: boolean;
};

export type ComponentState = ContextState & {
  name: string;
};

export type Context<T = Record<string | symbol, any>> = ContextState & T;

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
  _callListeners(context, MOUNT_LISTENERS);
}

export function unmountContext(context: Context) {
  if (!context.isMounted) return;
  context.isMounted = false;
  _callListeners(context, CLEANUP_LISTENERS);
}

function _callListeners(context: Context, key: symbol) {
  if (!Object.hasOwn(context, key)) return;
  for (const callback of context[key]) callback();
  context[key].length = 0;
}

/*===================================*\
||          Lifecycle Hooks          ||
\*===================================*/

export function onMount(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, MOUNT_LISTENERS)) context[MOUNT_LISTENERS] = [fn];
  else context[MOUNT_LISTENERS].push(fn);
}

export function onCleanup(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, CLEANUP_LISTENERS)) context[CLEANUP_LISTENERS] = [fn];
  else context[CLEANUP_LISTENERS].push(fn);
}

export function onEffect(context: Context, fn: () => void) {
  if (context.isMounted) {
    onCleanup(context, createEffect(fn));
  } else {
    onMount(context, () => {
      onCleanup(context, createEffect(fn));
    });
  }
}

/*===================================*\
||              Stores               ||
\*===================================*/

export const STORE_ID = Symbol("Dolla.StoreId");

export function addStore<Props, Returns>(
  context: Context,
  store: Store<Props, Returns> & { [STORE_ID]?: symbol },
  ...args: undefined extends Props ? [props?: Props] : [props: Props]
) {
  // Tag the store function with a unique symbol if it doesn't have one.
  store[STORE_ID] ??= Symbol(store.name);

  assert(!Object.hasOwn(context, store[STORE_ID]), "Store was already provided on this context.");

  // Give the store its own context bound to this lifecycle.
  const storeContext = createContext(context) as Context<ComponentState>;
  onMount(context, () => mountContext(storeContext));
  onCleanup(context, () => unmountContext(storeContext));
  storeContext.name = store.name;

  return (context[store[STORE_ID]!] = store.call(storeContext, args[0] as Props, storeContext));
}

export function getStore<Returns>(context: Context, store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  const id = store[STORE_ID];
  const result = id ? context[id] : undefined;
  assert(result != null, `Store '${store.name}' is not provided by this context.`);
  return result;
}
