import type { Renderable, View } from "../types.js";
import { assert, isFunction, isString } from "../utils.js";
import { type Context, createContext, GenericState, mountContext, cleanupContext } from "./context.js";
import { ViewNode } from "./markup/nodes/view.js";
import { type MarkupNode } from "./markup/types.js";
import { render } from "./markup/utils.js";
import { DEBUG, PARENT_ELEMENT } from "./symbols.js";

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

    rootNode = isFunction<View<{}>>(content) ? new ViewNode(context, content, {}) : render(content, context);
    rootNode?.mount(element!);

    mountContext(context);
  }

  async function unmount() {
    if (!context.isMounted) return;

    rootNode?.unmount(false);
    rootNode = null;

    cleanupContext(context);
  }

  return self;
}
