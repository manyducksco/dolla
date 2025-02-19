import { type ViewContext } from "../nodes/view.js";

/**
 * A utility view that simply displays its children.
 */
export function Passthrough(_: {}, ctx: ViewContext) {
  return ctx.outlet();
}
