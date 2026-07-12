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
  const live = function (this: any, props: P, ctx: any) {
    return current.call(this, props, ctx);
  } as View<P> & { __dolla_setImpl: (fn: View<P>) => void };
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
  for (const key of Object.keys(newModule)) {
    const newView = newModule[key];
    const oldView = exports[key];
    if (typeof oldView !== "function" || typeof newView !== "function") continue;

    // Live-wrapped views keep the same identity across HMR; replaceView
    // re-renders the node with the (already-updated) inner implementation.
    const instances = activeInstances.get(oldView);
    if (!instances) continue;

    for (const node of instances) {
      node.replaceView(newView);
    }
  }
}
