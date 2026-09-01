import type { Renderable, View } from "../types.js";
import { assert, isFunction, isString } from "../utils.js";
import { type Context, createContext, GenericState, mountContext, cleanupContext } from "./context.js";
import { ViewNode } from "./markup/nodes/view.js";
import { type MarkupNode } from "./markup/types.js";
import { render } from "./markup/utils.js";
import { DEBUG, PARENT_ELEMENT } from "./symbols.js";

// Marks an element that already hosts a dolla root, so a subsequent mount into
// the same element can tear down the previous instance instead of stacking a
// duplicate.
const ROOT_MARKER = Symbol("dolla:root-node");

/**
 * Plugins are simply functions that take a context object.
 * A plugin can return a Promise to suspend app mounting.
 * Hooks can be used to attach app lifecycle logic.
 */
export type DollaPlugin = (context: Context) => any;

export interface DollaRootOptions {
  /**
   * Adds additional view info to the DOM to help with debugging.
   */
  debug?: boolean;
}

export interface DollaRoot {
  /**
   * Registers a plugin to be added before `mount`.
   */
  plugin(plugin: DollaPlugin): DollaRoot;

  /**
   * Mounts a `view` to this root.
   */
  mount(view: View): Promise<void>;

  /**
   * Mounts any renderable content to this root.
   */
  mount(content: Renderable): Promise<void>;

  /**
   * Unmounts the currently mounted content.
   */
  unmount(): void;
}

export function createRoot(selector: string, options?: DollaRootOptions): DollaRoot;
export function createRoot(element: Element, options?: DollaRootOptions): DollaRoot;
export function createRoot(target: string | Element, options?: DollaRootOptions) {
  const element = isString(target) ? document.querySelector(target) : target;
  assert(element, "Element cannot be null.");

  const context = createContext<GenericState>(null, { name: "dolla:root" });

  const plugins: DollaPlugin[] = [];

  context[PARENT_ELEMENT] = element;
  context[DEBUG] = Boolean(options?.debug);

  let rootNode: MarkupNode | null = null;

  const self: DollaRoot = { plugin, mount, unmount };

  function plugin(fn: DollaPlugin) {
    plugins.push(fn);
    return self;
  }

  async function mount(content: View<{}> | Renderable) {
    if (context.isMounted) return;

    await Promise.all(plugins.map((fn) => fn(context)));

    // Defensive against duplicate mounts: a full HMR reload can re-run the entry
    // without disposing the previous instance, leaving its DOM stacked in #app.
    // If the target already hosts a dolla root, tear it down first so we never
    // stack duplicate routes. (A normal re-mount of a different root is handled
    // the same way — only one root per element is valid.)
    const existing = (element as any)?.[ROOT_MARKER];
    if (existing && existing !== rootNode) {
      try {
        existing.unmount?.();
      } catch {}
      if (element!.firstChild != null) element!.replaceChildren();
    }

    rootNode = isFunction<View<{}>>(content) ? new ViewNode(context, content, {}) : render(content, context);
    (element as any)[ROOT_MARKER] = rootNode;
    rootNode?.mount(element!);

    mountContext(context);
  }

  async function unmount() {
    // Always detach the mounted DOM. The previous early-return on
    // `!context.isMounted` could skip removal when the context had already
    // been cleaned up (e.g. during an HMR full-reload of the entry), leaving
    // the old content stacked in #app — producing the duplicated-Workspace
    // symptom. `rootNode.unmount(false)` is safe to call when already
    // unmounted, and `cleanupContext` no-ops when already cleaned up.
    rootNode?.unmount(false);
    rootNode = null;

    cleanupContext(context);

    if (element && (element as any)[ROOT_MARKER]) {
      try {
        delete (element as any)[ROOT_MARKER];
      } catch {}
    }
  }

  return self;
}
