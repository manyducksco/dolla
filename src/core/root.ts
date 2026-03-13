import type { Renderable, View } from "../types.js";
import { assert, getElement, isFunction } from "../utils.js";
import { type Context, createContext, mountContext, unmountContext } from "./context.js";
import { ViewNode } from "./markup/nodes/view.js";
import { type MarkupNode } from "./markup/types.js";
import { render } from "./markup/utils.js";
import { DEBUG, PARENT_ELEMENT } from "./symbols.js";

export type CleanupCallback = () => void | Promise<void>;

/**
 * Plugins run before the app is mounted. If they return a promise, mounting will be delayed until the promise resolves.
 * If a cleanup function is returned, it will be called before the app is unmounted. The cleanup function's promise will delay unmounting.
 *
 * Hooks can be used inside plugins.
 */
export type DollaPlugin = (context: Context) => Promise<CleanupCallback | void> | CleanupCallback | void;

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
  mount(view: View<{}>): Promise<void>;

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
  const element = getElement(target);
  assert(element, "Element cannot be null.");

  const context = createContext();
  const plugins: DollaPlugin[] = [];
  const cleanup: CleanupCallback[] = [];

  context[PARENT_ELEMENT] = element;
  context[DEBUG] = Boolean(options?.debug);

  let rootNode: MarkupNode | null = null;

  const self: DollaRoot = { plugin, mount, unmount };

  function plugin(plugin: DollaPlugin) {
    plugins.push(plugin);
    return self;
  }

  async function mount(content: View<{}> | Renderable) {
    if (context.isMounted) return;

    const results = await Promise.all(plugins.map((fn) => fn(context)));
    for (const result of results) {
      if (isFunction<CleanupCallback>(result)) {
        cleanup.push(result);
      }
    }

    rootNode = isFunction<View<{}>>(content) ? new ViewNode(context, content, {}) : render(content, context);
    rootNode?.mount(element!);

    mountContext(context);
  }

  async function unmount() {
    if (!context.isMounted) return;

    rootNode?.unmount(false);
    rootNode = null;

    unmountContext(context);

    await Promise.all(cleanup.map((callback) => callback()));
    cleanup.length = 0;
  }

  return self;
}
