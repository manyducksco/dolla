export { createRouter, RedirectError, lazy } from "./router";
export type { RouterOptions } from "./types";

import { $$context } from "../core";
import { RouterStore } from "./store";

export function $router() {
  return $$context().getStore(RouterStore);
}
