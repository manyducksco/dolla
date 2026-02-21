import type { Renderable } from "../../types.js";

/**
 * A utility view that displays its children.
 * Primarily used in JSX via the empty `<></>` tag.
 */
export function Fragment(props: { children?: Renderable }) {
  return props.children;
}
