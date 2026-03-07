import { isFunction } from "../typeChecking.js";
import { Renderable, View } from "../types.js";
import { getElement } from "../utils.js";
import { Context } from "./context.js";
import { LogLevel } from "./logger.js";
import { DynamicNode } from "./markup/nodes/dynamic.js";
import { ViewNode } from "./markup/nodes/view.js";
import { MarkupNode } from "./markup/types.js";
import { toMarkupNodes } from "./markup/utils.js";
import { DEBUG, PARENT_ELEMENT } from "./symbols.js";

export type CleanupCallback = () => void | Promise<void>;

/**
 * Plugins run before the app is mounted. If they return a promise, mounting will be delayed until the promise resolves.
 * If a cleanup function is returned, it will be called before the app is unmounted. The cleanup function's promise will delay unmounting.
 */
export type DollaPlugin = (context: Context) => Promise<CleanupCallback | void> | CleanupCallback | void;

export interface DollaDebugOptions {
  /**
   * Filters debug messages by context name. Messages will only be printed if this check returns truthy.
   *
   * @example
   * filter: "*,-dolla:*" // (everything, minus those starting with 'dolla:')
   *
   * filter: new RegExp("^(?!dolla:).*") // same thing but in RegExp form
   *
   * filter: (name) => !name.startsWith("dolla:")
   */
  filter?: string | RegExp | ((name: string) => any);

  level?: LogLevel;
}

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
  const context = new Context("dolla:root");
  const plugins: DollaPlugin[] = [];
  const cleanup: CleanupCallback[] = [];

  context.state[PARENT_ELEMENT] = element;
  context.state[DEBUG] = Boolean(options?.debug);

  let rootNode: MarkupNode | null = null;

  const self: DollaRoot = { plugin, mount, unmount };

  function plugin(plugin: DollaPlugin) {
    plugins.push(plugin);
    return self;
  }

  async function mount(content: Renderable) {
    if (context.isMounted) return;

    const results = await Promise.all(plugins.map((fn) => fn(context)));
    for (const result of results) {
      if (isFunction<CleanupCallback>(result)) {
        cleanup.push(result);
      }
    }

    if (isFunction<View<{}>>(content)) {
      rootNode = new ViewNode(context, content, {});
    } else {
      const nodes = toMarkupNodes(context, content);
      if (nodes.length === 1) {
        rootNode = nodes[0];
      } else {
        rootNode = new DynamicNode(context, () => nodes);
      }
    }

    rootNode?.mount(element);

    context.mount();
  }

  async function unmount() {
    if (!context.isMounted) return;

    rootNode?.unmount(false);
    rootNode = null;

    context.unmount();

    await Promise.all(cleanup.map((callback) => callback()));
    cleanup.length = 0;
  }

  return self;
}
