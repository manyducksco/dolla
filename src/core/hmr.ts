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
  Object.defineProperty(live, "__dolla_id", { value: id, enumerable: false });
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

function pathFromId(id: string | undefined): string {
  if (!id) return "(unknown)";
  const idx = id.lastIndexOf(":");
  return idx === -1 ? id : id.slice(0, idx);
}

function describeInstance(node: ViewNode<any>): string {
  if (!node.isMounted()) return "<unmounted>";
  const root = node.getRoot();
  if (!root) return "<detached>";
  if (!(root instanceof Element)) return root.nodeName.toLowerCase();
  const parts: string[] = [];
  let el: Element | null = root;
  while (el && el !== document.body && parts.length < 4) {
    let part = el.tagName.toLowerCase();
    if (el.id) part += `#${el.id}`;
    else {
      const cls = (el.getAttribute("class") ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(".");
      if (cls) part += `.${cls}`;
    }
    parts.unshift(part);
    el = el.parentElement;
  }
  return parts.join(" > ");
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
    locators: string[];
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
    const nodes = Array.from(instances);
    const locators: string[] = [];
    for (const node of nodes) {
      if (processed.has(node)) continue;
      processed.add(node);
      try {
        node.replaceView(newView);
      } catch (e) {
        console.error(`[dolla:hmr] ${key}: replaceView threw`, e);
        locators.push("<error>");
        continue;
      }
      try {
        locators.push(describeInstance(node));
      } catch (e) {
        locators.push("<unknown>");
      }
    }

    try {
      summary.push({
        key,
        oldName: (oldView as any).name ?? key,
        newName: (newView as any).name ?? key,
        path: pathFromId((oldView as any).__dolla_id),
        locators,
        elapsedMs: performance.now() - tExport,
      });
    } catch {
      // If anything above failed, still record the update without throwing.
    }
  }

  if (summary.length === 0) return;

  const total = summary.reduce((sum, s) => sum + s.locators.length, 0);
  const totalMs = performance.now() - t0;

  console.groupCollapsed(
    `[dolla:hmr] hot reload: ${total} view instance${total === 1 ? "" : "s"} across ${summary.length} export${summary.length === 1 ? "" : "s"} in ${totalMs.toFixed(2)}ms`,
  );
  for (const { key, oldName, newName, path, locators, elapsedMs } of summary) {
    const rename = oldName === newName ? oldName : `${oldName} → ${newName}`;
    console.log(
      `  ${key} (${path}): ${locators.length} instance${locators.length === 1 ? "" : "s"} in ${elapsedMs.toFixed(2)}ms — ${rename}`,
    );
    for (const loc of locators) {
      console.log(`    <${newName}> @ ${loc}`);
    }
  }
  console.groupEnd();
}
