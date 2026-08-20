import type { View } from "../types.js";
import type { ViewNode } from "./markup/nodes/view.js";

const activeInstances = new WeakMap<View<any>, Set<ViewNode<any>>>();

const liveViews = new Map<string, View<any>>();

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
  live.__dolla_setImpl = (fn) => {
    current = fn;
  };
  Object.defineProperty(live, "length", { get: () => current.length });
  Object.defineProperty(live, "name", { get: () => current.name });
  liveViews.set(id, live);
  return live;
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

export function __dolla_apply(
  newModule: Record<string, any>,
  exports: Record<string, View<any>>,
) {
  // Track nodes that have already been replaced in this HMR cycle so that
  // a view exposed under multiple keys (e.g. `Foo` and `default: Foo`) is
  // only applied once per node.
  const processed = new Set<ViewNode<any>>();
  const summary: Array<[string, number]> = [];

  for (const key of Object.keys(newModule)) {
    const newView = newModule[key];
    const oldView = exports[key];
    if (typeof oldView !== "function" || typeof newView !== "function") continue;

    const instances = activeInstances.get(oldView);
    if (!instances) continue;

    // Snapshot the Set so concurrent mutations inside replaceView (which
    // unregisters and re-registers the node) don't desync the iteration.
    const nodes = Array.from(instances);
    let count = 0;
    for (const node of nodes) {
      if (processed.has(node)) continue;
      processed.add(node);
      count++;
      try {
        node.replaceView(newView);
      } catch (e) {
        console.error(`[dolla:hmr] ${key}: replaceView threw`, e);
      }
    }
    summary.push([key, count]);
  }

  if (summary.length === 0) return;

  const total = summary.reduce((sum, [, n]) => sum + n, 0);
  console.groupCollapsed(
    `[dolla:hmr] hot reload: ${total} view instance${total === 1 ? "" : "s"} across ${summary.length} export${summary.length === 1 ? "" : "s"}`,
  );
  for (const [key, count] of summary) console.log(`  ${key}: ${count}`);
  console.groupEnd();
}
