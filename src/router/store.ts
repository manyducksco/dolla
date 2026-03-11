import { memo, peek, type Accessor, type Getter } from "../core";
import type { Router } from "./types";
import { mergeQueryParams, resolvePath, type HistoryAdapter, type Match } from "./utils";

export interface RouterStoreProps {
  currentMatch: Accessor<Match>;
  progress: Getter<number>;
  history: HistoryAdapter;
  updateRoute: () => void;
}

export function RouterStore({ currentMatch, progress, history, updateRoute }: RouterStoreProps): Router {
  return {
    path: memo(() => currentMatch().path),
    pattern: memo(() => currentMatch().pattern),
    params: memo(() => currentMatch().params),
    query: memo(() => currentMatch().query),
    meta: memo(() => currentMatch().meta),
    progress: progress,

    setQuery(params) {
      const m = peek(currentMatch);
      const path = m.path;
      const merged = mergeQueryParams(m.query, params, true);
      const query = Object.fromEntries(merged);

      currentMatch((prev) => ({ ...prev, query }));

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
      return memo(() => {
        const currentPath = currentMatch().path;

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
