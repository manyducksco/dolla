import type { View } from "../types.js";
import { cleanupContext, mountContext } from "./context.js";
import { runSafely } from "./errors.js";
import { hotTemplate, type CSSTemplate } from "./markup/css.js";
import { DOMNode } from "./markup/nodes/dom.js";
import { trackViewInstances, type ViewNode } from "./markup/nodes/view.js";
import type { MountTarget } from "./markup/types.js";
import { createTextNode } from "./markup/utils.js";
import { popContext, pushContext } from "./signal-debug.js";

const activeInstances = new WeakMap<View<any>, Set<ViewNode<any>>>();

const liveViews = new Map<string, View<any>>();

/** Same as `STORE_ID` in context.ts. Defined here so this module stays standalone. */
const STORE_ID = Symbol.for("$_STORE_ID");

/** The store identity for an HMR id, shared by every function with that id. */
const storeSymbol = (id: string) => Symbol.for(`$_DOLLA_STORE:${id}`);

/**
 * Gives `store` the stable store identity for `id`, the one its HMR wrapper has.
 * The Vite plugin wraps store arguments in this, because in an import cycle a
 * reloaded module's functions can be used as stores before the module has run
 * far enough to wrap them.
 */
export function __dolla_store<T extends Function>(id: string, store: T): T {
  (store as any)[STORE_ID] ??= storeSymbol(id);
  return store;
}

/**
 * Returns a `css` tag for the module-level template `id`. Every version of the template
 * is the same object with the same class name, so modules that imported it see each
 * update, and its rule is replaced in the stylesheet when its module reloads.
 */
export function __dolla_css(id: string) {
  return (strings: TemplateStringsArray, ...interpolations: any[]): CSSTemplate =>
    hotTemplate(id, strings, interpolations);
}

export function __dolla_export<P>(id: string, impl: View<P> | P): View<P> | P {
  if (typeof impl !== "function") return impl;
  const existing = liveViews.get(id) as View<P> | undefined;
  if (existing) {
    (existing as any).__dolla_setImpl(impl as View<P>);
    return existing;
  }
  let current: View<P> = impl as View<P>;
  const live = function (this: any, ...args: any[]) {
    return current.apply(this, args as Parameters<View<P>>);
  } as unknown as View<P> & { __dolla_setImpl: (fn: View<P>) => void };
  // Properties attached to the function (e.g. `log.info = ...`) are copied so they survive wrapping.
  let copied = copyOwnProps(live, impl, []);
  live.__dolla_setImpl = (fn) => {
    current = fn;
    copied = copyOwnProps(live, fn, copied);
  };
  Object.defineProperty(live, "length", { get: () => current.length });
  Object.defineProperty(live, "name", { get: () => current.name });
  Object.defineProperty(live, "__dolla_id", { value: id, enumerable: false });
  (live as any)[STORE_ID] ??= storeSymbol(id);
  liveViews.set(id, live);
  return live;
}

// The store id is the wrapper's own, so instances stay findable when the implementation changes.
const SKIPPED_KEYS = new Set<PropertyKey>(["length", "name", "prototype", "arguments", "caller", STORE_ID]);

/**
 * Copies `source`'s own properties onto `target`, removing those copied previously that `source` no longer has.
 * Returns the copied keys.
 */
function copyOwnProps(target: object, source: object, previous: PropertyKey[]): PropertyKey[] {
  for (const key of previous) delete (target as any)[key];
  const keys = Reflect.ownKeys(source).filter(
    (key) => !SKIPPED_KEYS.has(key) && !(typeof key === "string" && key.startsWith("__dolla_")),
  );
  for (const key of keys) {
    Object.defineProperty(target, key, { ...Object.getOwnPropertyDescriptor(source, key), configurable: true });
  }
  return keys;
}

export function registerViewInstance<P>(view: View<P>, node: ViewNode<P>) {
  let set = activeInstances.get(view);
  if (!set) {
    set = new Set();
    activeInstances.set(view, set);
  }
  set.add(node);
}

export function unregisterViewInstance<P>(view: View<P>, node: ViewNode<P>) {
  const set = activeInstances.get(view);
  if (set) {
    set.delete(node);
    if (set.size === 0) activeInstances.delete(view);
  }
}

// Views call these hooks on mount and unmount once this module has loaded.
trackViewInstances(registerViewInstance, unregisterViewInstance);

/**
 * Swaps the view function of a mounted (or not yet mounted) `ViewNode` for a hot-reloaded
 * one and re-renders it in place. Lives here rather than on `ViewNode` so production
 * builds, which never load this module, don't carry it.
 */
export function replaceView<P>(node: ViewNode<P>, newView: View<P>): void {
  const wasMounted = node.isMounted();
  if (!wasMounted) {
    unregisterViewInstance(node._view, node);
    node._view = newView;
    node.context.name = newView.name;
    registerViewInstance(node._view, node);
    return;
  }

  const oldRoot = node._node?.getRoot();
  const parent = oldRoot?.parentNode as MountTarget | undefined;
  const after = oldRoot?.previousSibling;

  runSafely(() => node._node?.unmount(), {
    phase: "unmount",
    context: node.context,
  });

  if (oldRoot && oldRoot.parentNode) {
    oldRoot.parentNode.removeChild(oldRoot);
  }

  cleanupContext(node.context);
  unregisterViewInstance(node._view, node);

  node._view = newView;
  node.context.name = newView.name;

  // The context was cleaned up above, so effects in the new view wait for `mountContext`
  // below, after their elements are in the DOM, just like on a first mount.
  try {
    pushContext(node.context);
    node._node = node._render();

    registerViewInstance(newView, node);

    if (parent) {
      node._node.mount(parent, after);
    }

    mountContext(node.context);
  } catch (e) {
    registerViewInstance(newView, node);
    try {
      node._node = new DOMNode(node.context, createTextNode(""));
      if (parent) {
        node._node.mount(parent, after);
      }
      mountContext(node.context);
    } catch {
      // Node stays unmounted; next HMR cycle will handle it.
    }
    throw e;
  } finally {
    popContext();
  }
}

function pathFromId(id: string | undefined): string {
  if (!id) return "(unknown)";
  const idx = id.lastIndexOf(":");
  return idx === -1 ? id : id.slice(0, idx);
}

export function __dolla_apply(newModule: Record<string, any>, exports: Record<string, View<any>>) {
  // Track nodes that have already been replaced in this HMR cycle so that
  // a view exposed under multiple keys (e.g. `Foo` and `default: Foo`) is
  // only applied once per node.
  const processed = new Set<ViewNode<any>>();
  const summary: Array<{
    key: string;
    oldName: string;
    newName: string;
    path: string;
    count: number;
    elapsedMs: number;
  }> = [];

  const t0 = performance.now();

  for (const key of Object.keys(newModule)) {
    const newView = newModule[key];
    const oldView = exports[key];
    if (typeof oldView !== "function" || typeof newView !== "function") continue;

    const instances = activeInstances.get(oldView);
    if (!instances) continue;

    const tExport = performance.now();

    // Snapshot the Set so concurrent mutations inside replaceView (which
    // unregisters and re-registers the node) don't desync the iteration.
    let count = 0;
    for (const node of Array.from(instances)) {
      if (processed.has(node)) continue;
      processed.add(node);
      count++;
      try {
        replaceView(node, newView);
      } catch (e) {
        console.error(`[dolla:hmr] ${key}: replaceView threw`, e);
      }
    }

    summary.push({
      key,
      oldName: (oldView as any).name ?? key,
      newName: (newView as any).name ?? key,
      path: pathFromId((oldView as any).__dolla_id),
      count,
      elapsedMs: performance.now() - tExport,
    });
  }

  if (summary.length === 0) return;

  const total = summary.reduce((sum, s) => sum + s.count, 0);
  const totalMs = performance.now() - t0;

  console.groupCollapsed(
    `[dolla:hmr] hot reload: ${total} view instance${total === 1 ? "" : "s"} across ${summary.length} export${summary.length === 1 ? "" : "s"} in ${totalMs.toFixed(2)}ms`,
  );
  for (const { key, oldName, newName, path, count, elapsedMs } of summary) {
    const rename = oldName === newName ? oldName : `${oldName} → ${newName}`;
    console.log(
      `  ${key} (${path}): ${count} instance${count === 1 ? "" : "s"} in ${elapsedMs.toFixed(2)}ms — ${rename}`,
    );
  }
  console.groupEnd();
}
