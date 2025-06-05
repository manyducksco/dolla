import { Context } from "../core/context.js";
import { Renderable } from "../types.js";

interface OutletProps {
  children?: Renderable;
}

export function Outlet(props: OutletProps, ctx: Context) {
  return props.children;
}
