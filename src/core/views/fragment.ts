import type { Renderable } from "../../types.js";
import { Context } from "../context.js";
import { m } from "../markup.js";

/**
 * A utility view that displays its children.
 */
export function Fragment(props: { children?: Renderable }, ctx: Context) {
  return props.children ?? null;
  // return m("$dynamic", { source: () => props.children });
}
