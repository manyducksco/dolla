import { getCurrentContext } from "../core/signals";
import { type Router, ROUTER } from "./router";

export function useRouter() {
  const context = getCurrentContext();
  if (!context) throw new Error(`Hooks can only be called in the body of a View, Store or Mixin.`);
  const router = context.getState<Router | null>(ROUTER, { fallback: null });
  if (!router) throw new Error(`useRoute can only be called within an app that uses a router.`);
  return router;
}

type RouteController = {
  /**
   * Call when the route is ready to mount.
   */
  next: () => void;
  /**
   * Call when navigation/transition needs to be cancelled.
   */
  cancel: (error: Error) => void;
};

type RoutePreloadFn = (controller: RouteController) => any;

function useRoutePreload(preload: RoutePreloadFn) {
  // TODO: Suspend route mounting until controller.next() is called by `preload`.
}

// Used unless a preload function is supplied by the user.
const defaultPreload: RoutePreloadFn = (ctrl) => ctrl.next();

type RouteTransitionOptions = {
  in?: (controller: RouteController) => any;
  out?: (controller: RouteController) => any;
};

function useRouteTransitions(options: RouteTransitionOptions) {
  // Starts after preload ends.
  // TODO: On transition in; mount this route, but suspend previous route's unmount until controller.next() is called.
  // TODO: On transition out; mount next route, but suspend this route's unmount until controller.next() is called.
}

// Merge route transition options with these default options.
const defaultTransitionOptions: RouteTransitionOptions = {
  in: (ctrl) => ctrl.next(),
  out: (ctrl) => ctrl.next(),
};

// useRoutePreload(async ({ next }) => {
//   await nextValueOf($botInfo, { where: (value) => value != null });
//   next();
// });

// useRouteTransitions({
//   in: ({ next }) => {
//     // animate("#whatever", onComplete: next);
//     next();
//   },
//   out: ({ next }) => {
//     next();
//   },
// });
