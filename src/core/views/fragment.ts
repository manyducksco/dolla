import type { Renderable } from "../../types.js";
import { markup } from "../markup.js";
import { type ViewContext } from "../nodes/view.js";
import { compose } from "../signals.js";

/**
 * A utility view that displays its children.
 */
export function Fragment(props: { children?: Renderable }, ctx: ViewContext) {
  return markup("$dynamic", { source: compose(() => props.children) });
}
