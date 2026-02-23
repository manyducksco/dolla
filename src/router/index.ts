export { createRouter } from "./router";
export type { RouterOptions } from "./types";

import { $$context } from "../core";
import { RouterStore } from "./store";

export function $router() {
  return $$context().useStore(RouterStore);
}

// export function $preload(loader: RoutePreloadFn) {
//   $$context().setState(VIEW_PRELOAD_CALLBACK, loader);
// }

// export function $transition(config: RouteTransitions) {
//   $$context().setState(VIEW_TRANSITIONS_CONFIG, config);

// Starts after preload ends.
// TODO: On transition in; mount this route, but suspend previous route's unmount until controller.next() is called.
// TODO: On transition out; mount next route, but suspend this route's unmount until controller.next() is called.
// }
