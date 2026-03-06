import { memo, peek, type Getter, type Setter } from "../core";
import type { Router } from "./types";
import { mergeQueryParams, resolvePath, type HistoryAdapter, type Match } from "./utils";

export interface RouterStoreProps {
  match: Getter<Match>;
  setMatch: Setter<Match>;
  progress: Getter<number>;
  history: HistoryAdapter;
  updateRoute: () => void;
}

export function RouterStore({ match, setMatch, progress, history, updateRoute }: RouterStoreProps): Router {
  return {
    path: memo(() => match().path),
    pattern: memo(() => match().pattern),
    params: memo(() => match().params),
    query: memo(() => match().query),
    meta: memo(() => match().meta),
    progress: progress,

    setQuery(params) {
      const m = peek(match);
      const path = m.path;
      const merged = mergeQueryParams(m.query, params, true);
      const query = Object.fromEntries(merged);

      setMatch((current) => ({ ...current, query }));

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
        const currentPath = match().path;

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
