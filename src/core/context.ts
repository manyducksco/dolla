import type { Store } from "../types.js";
import { assert } from "../utils.js";
import { VIEW, type ViewNode } from "./markup/nodes/view.js";
import { createEffect, withoutOwner } from "./signals.js";
import { pushContext, popContext } from "./signal-debug.js";
import { runSafely } from "./errors.js";
import { MOUNTED, PARENT_ELEMENT } from "./symbols.js";

export type LifecycleListener = () => any;

export type ContextState = {
  name: string;
};

export type GenericState = Record<string | symbol, any>;

export type Context<T = GenericState> = ContextState & T;

/*===================================*\
||              Context              ||
\*===================================*/

const MOUNT_LISTENERS = Symbol.for("$_CONTEXT_MOUNT_LISTENERS");
const CLEANUP_LISTENERS = Symbol.for("$_CONTEXT_CLEANUP_LISTENERS");

/**
 * Set on a context during `replaceView` to tell `onEffect` to run
 * immediately instead of deferring to `onMount` (which won't fire).
 */
export const REPLACING = Symbol.for("$_CONTEXT_REPLACING");

export function createContext<State extends GenericState>(
  parent: Context | null,
  values?: Partial<State>,
): Context<State> {
  return Object.assign(Object.create(parent), values);
}

/**
 * Returns true while the context lifecycle is mounted.
 *
 * This is a plain boolean read and is not reactive. It is the replacement for
 * the old `context.isMounted` field.
 */
export function isMounted(context: Context): boolean {
  return Object.hasOwn(context, MOUNTED);
}

export function mountContext(context: Context) {
  if (isMounted(context)) return;
  context[MOUNTED] = true;
  _callListeners(context, MOUNT_LISTENERS, "mount");
}

export function cleanupContext(context: Context) {
  // Discard pending mount listeners — they were registered for a mount that
  // isn't going to happen (e.g. during HMR replaceView).
  if (Object.hasOwn(context, MOUNT_LISTENERS)) context[MOUNT_LISTENERS].length = 0;

  if (!isMounted(context)) return;

  delete context[MOUNTED];
  _callListeners(context, CLEANUP_LISTENERS, "unmount");
}

function _callListeners(
  context: Context,
  key: symbol,
  phase: "mount" | "unmount",
) {
  if (!Object.hasOwn(context, key)) return;

  // Snapshot and detach before invoking so callbacks that register new
  // listeners do not mutate the list being iterated, and so one throwing
  // listener cannot leave the rest unrun.
  const callbacks: LifecycleListener[] = context[key];
  context[key] = [];

  for (const callback of callbacks) {
    runSafely(callback, { phase, context });
  }
}

/*===================================*\
||          Lifecycle Hooks          ||
\*===================================*/

/**
 * Registers a callback to run when the component is mounted into the DOM.
 */
export function onMount(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, MOUNT_LISTENERS)) context[MOUNT_LISTENERS] = [fn];
  else context[MOUNT_LISTENERS].push(fn);
}

/**
 * Registers a callback to run when the component is removed from the DOM.
 */
export function onCleanup(context: Context, fn: LifecycleListener) {
  if (!Object.hasOwn(context, CLEANUP_LISTENERS)) context[CLEANUP_LISTENERS] = [fn];
  else context[CLEANUP_LISTENERS].push(fn);
}

/**
 * Creates an effect that auto-tracks getters called within its callback.
 */
export function onEffect(context: Context, fn: () => void, options?: { name?: string }): void {
  const runEffect = () => {
    pushContext(context);
    // The context disposes this effect, so it must not also belong to whatever
    // effect happens to be running when the context mounts.
    const cleanup = withoutOwner(() => createEffect(fn, { ...options, context }));
    popContext();
    return cleanup;
  };

  if (isMounted(context) || context[REPLACING]) {
    onCleanup(context, runEffect());
  } else {
    onMount(context, () => {
      onCleanup(context, runEffect());
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
 * Returns the symbol that identifies a store function, creating it on first use.
 *
 * Stores are identified by the function itself, not its name, so two stores
 * that happen to share a name (common after minification) never collide.
 * Hot reload keeps working because the vite plugin wraps exported functions
 * with `__dolla_export`, which returns the same wrapper on every re-evaluation.
 */
function storeId(store: { name: string; [STORE_ID]?: symbol }): symbol {
  return (store[STORE_ID] ??= Symbol(store.name));
}

/**
 * Hidden property stored on the store result so `addStore` can retrieve
 * the store's sub-context on re-registration (e.g. during HMR).
 */
const STORE_CONTEXT = Symbol.for("$_STORE_CONTEXT");

/**
 * Creates a new store instance and attaches it to `context`. Returns the new store.
 * Children of this context can retrieve the nearest store instance from up the chain with `getStore(context)`.
 */
export function addStore<Props, Returns>(
  context: Context,
  store: Store<Props, Returns> & { [STORE_ID]?: symbol },
  ...args: undefined extends Props ? [props?: Props] : [props: Props]
) {
  const id = storeId(store);

  if (Object.hasOwn(context, id)) {
    // Re-register lifecycle listeners for the existing store so they
    // survive cleanupContext clearing MOUNT_LISTENERS during HMR.
    const existing = context[id];
    if (existing != null && existing[STORE_CONTEXT]) {
      const storeContext = existing[STORE_CONTEXT];
      onMount(context, () => mountContext(storeContext));
      onCleanup(context, () => cleanupContext(storeContext));
    }
    return existing;
  }

  // Give the store its own context bound to this lifecycle.
  const storeContext = createContext(context, { name: store.name });
  onMount(context, () => mountContext(storeContext));
  onCleanup(context, () => cleanupContext(storeContext));

  // Signals created by the store take its name and its root's debug setting.
  pushContext(storeContext);
  let result: Returns;
  try {
    result = store.call(storeContext, args[0] as Props, storeContext);
  } finally {
    popContext();
  }
  if (result != null) (result as any)[STORE_CONTEXT] = storeContext;
  return (context[id] = result);
}

/**
 * Gets the nearest instance of a store from up this context chain.
 */
export function getStore<Returns>(context: Context, store: Store<any, Returns> & { [STORE_ID]?: symbol }): Returns {
  const result = context[storeId(store)];
  assert(result != null, `Store '${store.name}' is not provided by this context.`);
  return result;
}

/**
 * Determines if an instance of a store is available on this context or up the context chain.
 */
export function hasStore(context: Context, store: Store<any, any> & { [STORE_ID]?: symbol }): boolean {
  // A store function that was never added has no symbol yet, so it can't be present.
  const id = store[STORE_ID];
  return id !== undefined && context[id] != null;
}

/**
 * Determines if an instance of a store is stored directly on this context.
 */
export function hasOwnStore(context: Context, store: Store<any, any> & { [STORE_ID]?: symbol }): boolean {
  const id = store[STORE_ID];
  return id !== undefined && Object.hasOwn(context, id);
}
