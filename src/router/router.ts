import { Context, onCleanup, onMount } from "../core/context.js";
import { DollaPlugin, addStore, createDebug, getRootElement } from "../core/index.js";
import { DynamicNode } from "../core/markup/nodes/dynamic.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import type { MarkupNode } from "../core/markup/types.js";
import { addListener, createMarkup } from "../core/markup/utils.js";
import { batch, createAtom, peek } from "../core/signals.js";
import { DEBUG } from "../core/symbols.js";
import type { View } from "../types.js";
import { assert } from "../utils.js";
import { RouterStore } from "./store.js";
import type { ActiveLayer, LazyLoader, LazyView, RouterOptions } from "./types.js";
import {
  buildRouteTree,
  catchLinks,
  createHistoryAdapter,
  mergeQueryParams,
  replaceParams,
  resolveRoute,
  type Match,
} from "./utils.js";

const ROUTER_ROOT_SLOT = Symbol.for("$_ROUTER_ROOT_SLOT");

/**
 * Lazy loads a view when its route is first matched.
 *
 * @example
 * {
 * path: "/users",
 * view: lazy(() => import("./views/users.js"))
 * }
 */
export function lazy(load: LazyLoader): LazyView {
  return { _lazy: true, load };
}

export function createRouter(options: RouterOptions): DollaPlugin {
  return function (context) {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    const history = createHistoryAdapter(!!options.hash);
    const scrollCache = new Map<string, number>();
    let currentKey = history.getKey();

    const [currentMatch, setCurrentMatch] = createAtom<Match>({
      path: history.getPath(),
      pattern: "",
      params: {},
      query: Object.fromEntries(new URLSearchParams(history.getSearch())),
      meta: {},
    });

    const [progress, setProgress] = createAtom(0);
    const routeTree = buildRouteTree(options.routes);

    const guards = new Set<() => boolean | Promise<boolean>>();

    const console = createDebug("dolla:router");
    const [rootSlot, setRootSlot] = createAtom<MarkupNode>();

    context[ROUTER_ROOT_SLOT] = rootSlot;

    const rootLayer: Partial<ActiveLayer> = {
      context,
      slot: rootSlot,
      setSlot: setRootSlot,
    };

    const activeLayers: ActiveLayer[] = [];

    /**
     * Run when the location changes. Diffs and mounts new routes and updates
     * the signals accordingly.
     */
    async function updateRoute(href?: string) {
      scrollCache.set(currentKey, window.scrollY);

      const path = href ?? history.getPath();
      const { match, journey } = await resolveRoute(routeTree, path);

      if (context[DEBUG]) {
        for (let i = 0; i < journey.length; i++) {
          const step = journey[i];
          const tag = `(update ${i + 1}/${journey.length})`;
          if (step.kind === "match") {
            console.info(`📍 ${tag} ${step.message}`);
          } else if (step.kind === "redirect") {
            console.info(`↩️ ${tag} ${step.message}`);
          } else {
            console.info(`💀 ${tag} ${step.message}`);
          }
        }
      }

      if (!match) throw new Error(`Failed to match route '${path}'`);

      const { layers, params } = match;
      const targetKeys: string[] = [];
      let branchIndex = 0;

      // Compute keys and find out where mounted layers diverge from matched layers
      for (let i = 0; i < layers.length; i++) {
        const key = `${layers[i].id}:${replaceParams(layers[i].pattern, params)}`;
        targetKeys.push(key);
        if (branchIndex === i && activeLayers[i]?.key === key) branchIndex++;
      }

      const tasks: Promise<void>[] = [];
      const preloadedData: any[] = []; // Offsets match loop index minus divIndex

      // Execute preloads and lazy component fetches
      for (let i = branchIndex; i < layers.length; i++) {
        const layer = layers[i];

        if (layer.preload) {
          tasks.push(
            Promise.resolve(layer.preload(match)).then((data) => {
              preloadedData[i - branchIndex] = data;
            }),
          );
        }

        const view = layer.view as LazyView;
        if (view._lazy) {
          tasks.push(
            view.load().then((mod) => {
              layer.view = (mod as any).default ?? mod; // Overwrite with loaded module
            }),
          );
        }
      }

      let caughtError: Error | null = null;
      let errorIndex = -1;

      // Track loading progress if there are async tasks
      if (tasks.length > 0) {
        setProgress(0.1);
        let completed = 0;
        const increment = 0.8 / tasks.length;

        tasks.forEach((p) => p.then(() => setProgress(0.1 + ++completed * increment)).catch(() => {}));

        try {
          await Promise.all(tasks);
        } catch (error) {
          setProgress(0);
          if (error instanceof RedirectError) return api.replace(error.redirectPath);

          caughtError = error instanceof Error ? error : new Error(String(error));
          errorIndex = branchIndex;
        }
      }

      // Merge query params and sync URL if redirect occurred
      const query = mergeQueryParams(peek(currentMatch).query, match.query, options.preserveQuery);
      const queryString = query.toString();
      const newUrl = match.path + (queryString ? `?${queryString}` : "");

      if (newUrl !== history.getPath() + history.getSearch()) {
        history.replace(newUrl);
      }

      // Batch state updates and DOM mutations
      batch(() => {
        setCurrentMatch({ ...match, query: Object.fromEntries(query) });

        if (branchIndex === layers.length && activeLayers.length === layers.length) return;

        // Fast truncate arrays and drop old DOM branches
        if (activeLayers[branchIndex]) {
          activeLayers[branchIndex].node.unmount();
          activeLayers.length = branchIndex;
        }

        // Mount new layers
        for (let i = branchIndex; i < layers.length; i++) {
          const layer = layers[i];
          const parent = activeLayers[i - 1] ?? rootLayer;
          const [slot, setSlot] = createAtom<MarkupNode>();

          let viewToMount = layer.view as View<any>;
          let propsToPass: any = {
            data: preloadedData[i - branchIndex],
            children: createMarkup(DynamicNode, { args: [slot] }),
          };

          // Handle Error Boundaries
          if (caughtError && i === errorIndex) {
            if (!layer.errorView) throw caughtError;
            viewToMount = layer.errorView;
            propsToPass = { error: caughtError };
          }

          const node = new ViewNode(parent.context!, viewToMount, propsToPass);
          parent.setSlot(node);

          activeLayers.push({
            id: layer.id,
            key: targetKeys[i],
            node,
            context: node.context,
            slot,
            setSlot,
          });

          if (caughtError && i === errorIndex) break;
        }
      });

      setProgress(0);

      requestAnimationFrame(() => {
        window.scrollTo(0, scrollCache.get(history.getKey()) ?? 0);
        currentKey = history.getKey();
      });
    }

    const api = addStore(context, RouterStore, {
      currentMatch,
      setCurrentMatch,
      progress,
      history,
      updateRoute,
      guards,
    });

    onMount(context, () => {
      let isReverting = false;
      let isReplaying = false;
      let lastIndex = history.getIndex();

      const removePop = addListener(window, "popstate", async () => {
        // If this popstate is the result of us reverting the URL, ignore it.
        if (isReverting) {
          isReverting = false;
          return;
        }

        // If this popstate is the result of us replaying an allowed navigation, accept it.
        if (isReplaying) {
          isReplaying = false;
          lastIndex = history.getIndex();
          updateRoute();
          return;
        }

        const newIndex = history.getIndex();
        const delta = lastIndex - newIndex; // Positive if user clicked Back

        // If guards exist, revert synchronously first
        if (guards.size > 0) {
          isReverting = true;
          window.history.go(delta); // Restores the URL immediately

          // Run guards while the URL is back in its original state
          let blocked = false;
          for (const guard of guards) {
            if (await guard()) {
              blocked = true;
              break;
            }
          }

          // If guards passed, replay the intended navigation
          if (!blocked) {
            isReplaying = true;
            window.history.go(-delta);
          }
          return;
        }

        // Normal flow (no guards)
        lastIndex = newIndex;
        updateRoute();
      });

      // Block tab closure/reload if guards exist
      const removeUnload = addListener(window, "beforeunload", (e: BeforeUnloadEvent) => {
        if (guards.size > 0) {
          e.preventDefault();
          e.returnValue = ""; // Triggers the native browser warning dialog
        }
      });

      const removeClick = catchLinks(getRootElement(context), api.push);

      onCleanup(context, () => {
        removePop();
        removeUnload();
        removeClick();
      });

      updateRoute();
    });
  };
}

/**
 * Displays the router's content.
 */
export function Outlet(this: Context) {
  this.name = "dolla:router";

  const rootSlot = this[ROUTER_ROOT_SLOT];
  assert(rootSlot != null, "Router plugin not found on root.");

  return new DynamicNode(this, rootSlot);
}

export class RedirectError extends Error {
  constructor(public redirectPath: string) {
    super(`Redirecting to ${redirectPath}`);
    this.name = "RedirectError";
  }
}
