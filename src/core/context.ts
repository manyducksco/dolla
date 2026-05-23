import { Store } from "../types.js";
import { assert } from "../utils.js";
import { VIEW, ViewNode } from "./markup/nodes/view.js";
import { createEffect, Unwrapped } from "./signals.js";
import { PARENT_ELEMENT } from "./symbols.js";

export type LifecycleListener = () => any;

export type ContextState = {
  isMounted: boolean;
  name: string;
};

export type GenericState = Record<string | symbol, any>;

export type Context<T = GenericState> = ContextState & T;

/*===================================*\
||              Context              ||
\*===================================*/

const MOUNT_LISTENERS = Symbol.for("$_CONTEXT_MOUNT_LISTENERS");
const CLEANUP_LISTENERS = Symbol.for("$_CONTEXT_CLEANUP_LISTENERS");

export function createContext<State extends GenericState>(
  parent: Context | null,
  values?: Partial<State>,
): Context<State> {
  return Object.assign(Object.create(parent), { isMounted: false, ...values });
}

export function mountContext(context: Context) {
  if (context.isMounted) return;
  context.isMounted = true;
  _callListeners(context, MOUNT_LISTENERS);
}

export function cleanupContext(context: Context) {
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

/**
 * Creates an effect that auto-tracks getters called within its callback.
 */
export function onEffect(context: Context, fn: () => void): void;

/**
 * Creates an effect that tracks getters in its `deps` array.
 * Unwrapped values from `deps` are passed as arguments to the callback.
 * Getters called inside the callback are not tracked.
 */
export function onEffect<const T extends readonly any[]>(
  context: Context,
  fn: (...values: Unwrapped<T>) => void,
  deps: T,
): void;

export function onEffect(context: Context, fn: () => void, deps?: any[]) {
  if (context.isMounted) {
    onCleanup(context, createEffect(fn, deps));
  } else {
    onMount(context, () => {
      onCleanup(context, createEffect(fn, deps));
    });
  }
}

/*===================================*\
||          Traversal Hooks          ||
\*===================================*/

/**
 * Returns the parent element of the root we're mounted in.
 */
export function getRootElement(context: Context): Element {
  return context[PARENT_ELEMENT];
}

/**
 * Returns the ViewNode of the nearest view up the context chain.
 */
export function getNearestViewNode<Props = unknown>(context: Context): ViewNode<Props> | undefined {
  return context[VIEW];
}

/*===================================*\
||              Stores               ||
\*===================================*/

export const STORE_ID = Symbol.for("$_STORE_ID");

/**
 * Creates a new store instance and attaches it to `context`. Returns the new store.
 * Children of this context can retrieve the nearest store instance from up the chain with `getStore(context)`.
 */
export function addStore<Props, Returns>(
  context: Context,
  store: Store<Props, Returns> & { [STORE_ID]?: symbol },
  ...args: undefined extends Props ? [props?: Props] : [props: Props]
) {
  // Tag the store function with a unique symbol if it doesn't have one.
  store[STORE_ID] ??= Symbol(store.name);

  assert(!Object.hasOwn(context, store[STORE_ID]), "Store was already provided on this context.");

  // Give the store its own context bound to this lifecycle.
  const storeContext = createContext(context, { name: store.name });
  onMount(context, () => mountContext(storeContext));
  onCleanup(context, () => cleanupContext(storeContext));

  return (context[store[STORE_ID]!] = store.call(storeContext, args[0] as Props, storeContext));
}

/**
 * Gets the nearest instance of a store from up this context chain.
 */
export function getStore<Returns>(context: Context, store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  const id = store[STORE_ID];
  const result = id ? context[id] : undefined;
  assert(result != null, `Store '${store.name}' is not provided by this context.`);
  return result;
}

/**
 * Determines if an instance of a store is available on this context or up the context chain.
 */
export function hasStore(context: Context, store: Store<any, any> & { [STORE_ID]?: symbol }): boolean {
  const id = store[STORE_ID];
  if (!id) return false;
  return context[id] != null;
}

/**
 * Determines if an instance of a store is stored directly on this context.
 */
export function hasOwnStore(context: Context, store: Store<any, any> & { [STORE_ID]?: symbol }): boolean {
  const id = store[STORE_ID];
  if (!id) return false;
  return Object.hasOwn(context, id);
}
