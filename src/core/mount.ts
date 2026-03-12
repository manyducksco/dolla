import { Renderable, View } from "../types.js";
import { isFunction } from "../utils.js";
import { createContext } from "./context.js";
import { ViewNode } from "./markup/nodes/view.js";
import { MountTarget } from "./markup/types.js";
import { render } from "./markup/utils.js";
import { DEBUG, PARENT_ELEMENT } from "./symbols.js";

export interface MountOptions {
  debug?: boolean;
}

/**
 * Mounts a chunk of renderable content into `parent` and returns a function to unmount.
 * If `content` is a function it will be interpreted as a view.
 */
export function mount(content: Renderable, parent: MountTarget, options?: MountOptions): () => void {
  const context = createContext();
  context[PARENT_ELEMENT] = parent;
  context[DEBUG] = Boolean(options?.debug);
  const node = isFunction(content) ? new ViewNode(context, content as View<{}>, {}) : render(content, context);
  node.mount(parent);
  return () => node.unmount();
}
