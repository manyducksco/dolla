import type { View } from "../types.js";
import type { ViewNode } from "./markup/nodes/view.js";

const activeInstances = new WeakMap<View<any>, Set<ViewNode<any>>>();

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

    const instances = activeInstances.get(oldView);
    if (!instances) continue;

    for (const node of instances) {
      node.replaceView(newView);
    }
  }
}
