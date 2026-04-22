import { compose, getDebug, peek, type Context, type Getter, type Setter } from "../core";
import type { Router } from "./types";
import { mergeQueryParams, resolvePath, type HistoryAdapter, type Match } from "./utils";

export interface RouterStoreProps {
  currentMatch: Getter<Match>;
  setCurrentMatch: Setter<Match>;
  progress: Getter<number>;
  history: HistoryAdapter;
  updateRoute: () => void;
  guards: Set<() => boolean | Promise<boolean>>;
}

export function RouterStore(
  this: Context,
  { currentMatch, setCurrentMatch, progress, history, updateRoute, guards }: RouterStoreProps,
): Router {
  this.name = "dolla:router";
  const debug = getDebug(this);

  async function navigate(path: string, replace: boolean) {
    for (const guard of guards) {
      if (await guard()) return;
    }

    debug.info(`🗺️ navigating to '${path}'${replace ? " (replace)" : ""}`);

    const resolved = resolvePath(history.getPath(), path);
    replace ? history.replace(resolved) : history.push(resolved);
    updateRoute();
  }

  return {
    path: compose(() => currentMatch().path),
    pattern: compose(() => currentMatch().pattern),
    params: compose(() => currentMatch().params),
    query: compose(() => currentMatch().query),
    meta: compose(() => currentMatch().meta),
    progress: progress,

    setQuery(params) {
      const m = peek(currentMatch);
      const merged = mergeQueryParams(m.query, params, true);
      const query = Object.fromEntries(merged);

      setCurrentMatch({ ...m, query });

      const queryString = merged.size ? "?" + merged.toString() : "";
      history.replace(m.path + queryString);

      return query;
    },

    back: (steps = 1) => window.history.go(-steps),
    forward: (steps = 1) => window.history.go(steps),

    push: (path) => navigate(path, false),
    replace: (path) => navigate(path, true),

    block: (guard) => {
      guards.add(guard);
      return () => guards.delete(guard);
    },

    isActive(path: string, exact = false) {
      const target = path === "/" ? "/" : path.replace(/\/$/, "");
      const targetSlash = target === "/" ? "/" : target + "/";

      return compose(() => {
        const current = currentMatch().path;
        const normalized = current === "/" ? "/" : current.replace(/\/$/, "");

        if (exact) return normalized === target;

        // Ensure segment boundaries match (prevents /app matching /apple)
        return normalized === target || normalized.startsWith(targetSlash);
      });
    },
  };
}
