import { computed, Reactive, type Mutable } from "../core";
import type { Router } from "./types";
import { type HistoryAdapter, type Match, mergeQueryParams, resolvePath } from "./utils";

export interface RouterStoreProps {
  match: Mutable<Match>;
  progress: Mutable<number>;
  history: HistoryAdapter;
  updateRoute: () => void;
}

export function RouterStore({ match, progress, history, updateRoute }: RouterStoreProps): Router {
  return {
    path: computed(() => match.track().path),
    pattern: computed(() => match.track().pattern),
    params: computed(() => match.track().params),
    query: computed(() => match.track().query),
    meta: computed(() => match.track().meta),
    progress: computed(() => progress.track()),

    updateQuery(params) {
      const path = match.get().path;
      const merged = mergeQueryParams(match.get().query, params, true);
      const query = Object.fromEntries(merged);

      match.update((current) => ({ ...current, query }));

      const queryString = merged.size > 0 ? "?" + merged.toString() : "";
      history.replace(path + queryString);

      return query;
    },

    back(steps = 1) {
      window.history.go(-steps);
    },

    forward(steps = 1) {
      window.history.go(steps);
    },

    push(path: string) {
      path = resolvePath(history.getPath(), path);
      history.push(path);
      updateRoute();
    },

    replace(path: string) {
      path = resolvePath(history.getPath(), path);
      history.replace(path);
      updateRoute();
    },

    block(guard) {
      return () => {};
    },

    isActive(path: string, exact = false) {
      return computed(() => {
        const currentPath = match.track().path;

        if (exact) {
          // Normalize trailing slashes for exact match
          const currentNormal = currentPath === "/" ? "/" : currentPath.replace(/\/$/, "");
          const targetNormal = path === "/" ? "/" : path.replace(/\/$/, "");
          return currentNormal === targetNormal;
        }

        // Ensure segment boundaries match (prevents /app matching /apple)
        const currentSegments = currentPath.split("/").filter(Boolean);
        const targetSegments = path.split("/").filter(Boolean);

        if (targetSegments.length > currentSegments.length) return false;

        for (let i = 0; i < targetSegments.length; i++) {
          if (currentSegments[i] !== targetSegments[i]) return false;
        }

        return true;
      });
    },
  };
}
