import { type ViewContext } from "../view.js";

export function DefaultView(_: {}, ctx: ViewContext) {
  return ctx.outlet();
}
