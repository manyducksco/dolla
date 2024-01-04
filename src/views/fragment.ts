import { type ViewContext } from "../view.js";

export function Fragment(_: {}, ctx: ViewContext) {
  return ctx.outlet();
}
