import { Router, RouterOptions } from "./router.js";

export function createRouter(options: RouterOptions): Router {
  return new Router(options);
}
