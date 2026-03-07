export { createRouter, RedirectError, lazy } from "./router";
export type { RouterOptions } from "./types";

import { $use } from "../core";
import { RouterStore } from "./store";

export function $router() {
  return $use(RouterStore);
}
