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

export function createContext<State extends GenericState>(
  parent: Context | null,
  values?: Partial<State>,
): Context<State> {
  return Object.assign(Object.create(parent), values);
}

/**
 * Returns true while the context lifecycle is mounted.
 *
 * This is a plain boolean read and is not reactive.
 */
export function isMounted(context: Context): boolean {
  // Only its own flag counts. A context also inherits its parent's.
  return Object.hasOwn(context, MOUNTED) && context[MOUNTED] === true;
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

  // Set to false rather than deleted, because deleting a property slows down later access to the object.
  context[MOUNTED] = false;
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
 * The effect starts when the context mounts and stops when it is cleaned up.
 * Returns a function that stops it early.
 */
export function onEffect(context: Context, fn: () => void, options?: { name?: string }): () => void {
  let stop: (() => void) | undefined;
  let stopped = false;

  const start = () => {
    if (stopped) return;
    pushContext(context);
    // The context disposes this effect, so it must not also belong to whatever
    // effect happens to be running when the context mounts.
    stop = withoutOwner(() => createEffect(fn, { ...options, context }));
    popContext();
    onCleanup(context, dispose);
  };

  const dispose = () => {
    stopped = true;
    stop?.();
    stop = undefined;
  };

  if (isMounted(context)) start();
  else onMount(context, start);

  return dispose;
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
 * Set on a view's context by the HMR runtime while it re-renders the view in place.
 * Its stores stay alive through the re-render, and the ids of those the new render
 * adds again are collected in this Set.
 */
const HMR_REPLACING = Symbol.for("$_HMR_REPLACING");

/**
 * Creates a new store instance and attaches it to `context`. Returns the new store.
 * Children of this context can retrieve the nearest store instance from up the chain with `getStore(context)`.
 */
export function addStore<Props, Returns>(
  context: Context,
  store: Store<Props, Returns> & { [STORE_ID]?: symbol },
  // Props can be omitted when they accept `undefined` or have no required keys (e.g. `{}`).
  ...args: undefined extends Props ? [props?: Props] : {} extends Props ? [props?: Props] : [props: Props]
) {
  const id = storeId(store);
  const bind = (storeContext: Context) => {
    onMount(context, () => mountContext(storeContext));
    onCleanup(context, () => {
      if (!Object.hasOwn(context, HMR_REPLACING)) cleanupContext(storeContext);
    });
  };

  if (Object.hasOwn(context, id)) {
    // Re-register lifecycle listeners for the existing store so they
    // survive cleanupContext clearing MOUNT_LISTENERS during HMR.
    const existing = context[id];
    if (existing?.[STORE_CONTEXT]) bind(existing[STORE_CONTEXT]);
    context[HMR_REPLACING]?.add(id);
    return existing;
  }

  // Give the store its own context bound to this lifecycle.
  const storeContext = createContext(context, { name: store.name });
  bind(storeContext);

  // Signals created by the store take its name and its root's debug setting.
  pushContext(storeContext);
  let result: Returns;
  try {
    // Omitted props default to `{}`, as views always receive an object.
    result = store.call(storeContext, (args.length ? args[0] : {}) as Props, storeContext);
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
