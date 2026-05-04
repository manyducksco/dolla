import { Context, getStore } from "../core";
import { RouterStore } from "./store";

export { createRouter, lazy, Outlet, RedirectError } from "./router";
export type { RouterOptions } from "./types";

export function getRouter(context: Context) {
  return getStore(context, RouterStore);
}
