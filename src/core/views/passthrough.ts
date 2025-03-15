import { type ViewContext } from "../nodes/view.js";

/**
 * A utility view that simply displays a route.
 */
export function Passthrough(_: {}, ctx: ViewContext) {
  return ctx.outlet();
}
