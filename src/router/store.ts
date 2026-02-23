import { computed, shallowEqual, type Mutable } from "../core";
import { QueryParams } from "./query";
import type { RouterAPI, RouterOptions } from "./types";
import { resolvePath, type RouteMatch } from "./utils";

export interface RouterStoreProps {
  match: Mutable<RouteMatch | undefined>;
  options: RouterOptions;
  updateRoute: () => void;
}

export function RouterStore({ match, options, updateRoute }: RouterStoreProps): RouterAPI {
  return {
    match: {
      path: computed(() => match.track()?.path ?? window.location.pathname),
      pattern: computed(() => match.track()?.pattern),
      params: computed(() => match.track()?.params ?? {}, { equals: shallowEqual }),
      query: new QueryParams(match, options),
      meta: computed(() => match.track()?.meta.data ?? {}, { equals: shallowEqual }),
    },

    back(steps = 1) {
      window.history.go(-steps);
    },

    forward(steps = 1) {
      window.history.go(steps);
    },

    push(path: string) {
      path = resolvePath(window.location.pathname, path);
      window.history.pushState(null, "", options.hash ? "/#" + path : path);
      updateRoute();
    },

    replace(path: string) {
      path = resolvePath(window.location.pathname, path);
      window.history.replaceState(null, "", options.hash ? "/#" + path : path);
      updateRoute();
    },
  };
}
