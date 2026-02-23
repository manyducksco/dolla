import type { Renderable } from "../../types.js";

export interface FragmentProps {
  children?: Renderable;
}

/**
 * A utility view that displays its children.
 * Primarily used in JSX via the empty `<></>` tag.
 */
export function Fragment(props: FragmentProps) {
  return props.children;
}
