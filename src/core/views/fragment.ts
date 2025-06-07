import type { Renderable } from "../../types.js";

/**
 * A utility view that displays its children.
 */
export function Fragment(props: { children?: Renderable }) {
  return props.children;
}
