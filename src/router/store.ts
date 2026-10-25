import { getStore, type Context } from "../core/context.js";
import { getDebug } from "../core/debug.js";
import { compose, peek, unwrap, type Getter, type MaybeGetter, type Setter } from "../core/signals.js";
import type { Router } from "./types";
import { mergeQueryParams, resolvePath, type HistoryAdapter, type Match } from "./utils";

export interface RouterStoreProps {
  currentMatch: Getter<Match>;
  setCurrentMatch: Setter<Match>;
  progress: Getter<number>;
  history: HistoryAdapter;
  updateRoute: () => void;
}

export function RouterStore(props: RouterStoreProps, c: Context): Router {
  c.name = "dolla:router";

  const console = getDebug(c);

  const { currentMatch, setCurrentMatch, progress, history, updateRoute } = props;

  function navigate(path: string, replace: boolean) {
    console.info(`🗺️ navigating to '${path}'${replace ? " (replace)" : ""}`);

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

    isActive(path: MaybeGetter<string>, exact = false) {
      return compose(() => {
        const _path = unwrap(path);
        const target = _path === "/" ? "/" : _path.replace(/\/$/, "");
        const targetSlash = target === "/" ? "/" : target + "/";

        const current = currentMatch().path;
        const normalized = current === "/" ? "/" : current.replace(/\/$/, "");

        if (exact) return normalized === target;

        // Ensure segment boundaries match (prevents /app matching /apple)
        return normalized === target || normalized.startsWith(targetSlash);
      });
    },
  };
}

export function getRouter(c: Context) {
  return getStore(c, RouterStore);
}
