import { Context, provide, inject, onMount, onCleanup } from "../core/context.js";
import { Debug } from "../debug/index.js";
import { DynamicNode } from "../core/markup/nodes/dynamic.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import type { MarkupNode } from "../core/markup/types.js";
import { createMarkup } from "../core/markup/utils.js";
import { batch, peek, state } from "../core/signals.js";
import { DEBUG, PARENT_ELEMENT } from "../core/symbols.js";
import type { View } from "../types.js";
import { uniqueId } from "../utils.js";
import { RouterStore } from "./store.js";
import type { ActiveLayer, LazyLoader, LazyView, RouteLayer, RouterOptions } from "./types.js";
import {
  buildRouteTree,
  catchLinks,
  createHistoryAdapter,
  type Match,
  mergeQueryParams,
  replaceParams,
  resolveRoute,
} from "./utils.js";

/**
 * Lazy loads a view when its route is first matched.
 *
 * @example
 * {
 *   path: "/users",
 *   view: lazy(() => import("./views/users.js"))
 * }
 */
export function lazy(load: LazyLoader): LazyView {
  return { _lazy: true, load };
}

export function createRouter(options: RouterOptions): View {
  if ("scrollRestoration" in window.history) {
    window.history.scrollRestoration = "manual";
  }

  const history = createHistoryAdapter(!!options.hash);
  const scrollCache = new Map<string, number>();
  let currentKey = history.getKey();

  const currentMatch = state<Match>({
    path: history.getPath(),
    pattern: "",
    params: {},
    query: Object.fromEntries(new URLSearchParams(history.getSearch())),
    meta: {},
  });
  const progress = state(0);

  const routeTree = buildRouteTree(options.routes);

  return function RouterView(this: Context) {
    const context = this;

    this.name = "dolla:router";

    const console = new Debug("dolla:router");

    const rootSlot = state<MarkupNode>();
    const rootLayer = {
      id: uniqueId(),
      node: new DynamicNode(context, rootSlot),
      context,
      slot: rootSlot,
    };
    const activeLayers: ActiveLayer[] = [];

    /**
     * Run when the location changes. Diffs and mounts new routes and updates
     * the $path, $route, $params and $query states accordingly.
     */
    async function updateRoute(href?: string | undefined, isPopState = false) {
      // Record the outgoing page's scroll position.
      scrollCache.set(currentKey, window.scrollY);

      const path = href ?? history.getPath();
      const { match, journey } = await resolveRoute(routeTree, path);

      if (context[DEBUG]) {
        for (let i = 0; i < journey.length; i++) {
          const step = journey[i];
          const tag = `(update: step ${i + 1} of ${journey.length})`;

          switch (step.kind) {
            case "match":
              console.info(`${tag} 📍 ${step.message}`);
              break;
            case "redirect":
              console.info(`${tag} ↩️ ${step.message}`);
              break;
            case "miss":
              console.info(`${tag} 💀 ${step.message}`);
              break;
            default:
              break;
          }
        }
      }

      if (!match) {
        throw new NoRouteError(`Failed to match route '${path}'`);
      }

      const { layers, params } = match;

      const layerKeys = layers.map((layer) => {
        return `${layer.id}:${replaceParams(layer.pattern, params)}`;
      });

      // Find the index where the layers diverge.
      let divergenceIndex = 0;
      while (
        divergenceIndex < layers.length &&
        divergenceIndex < activeLayers.length &&
        layerKeys[divergenceIndex] === activeLayers[divergenceIndex].key
      ) {
        divergenceIndex++;
      }

      // Execute preloads for the new layers.
      const newLayers = layers.slice(divergenceIndex);
      const preloadedData: any[] = new Array(newLayers.length).fill(null);

      const tasks: Promise<void>[] = [];

      newLayers.forEach((layer, index) => {
        // Queue data preload
        if (layer.preload) {
          const dataPromise = Promise.resolve(layer.preload(match)).then((data) => {
            preloadedData[index] = data;
          });
          tasks.push(dataPromise);
        }

        // Queue async component fetch.
        if (layer.view && typeof layer.view === "object" && "_lazy" in layer.view) {
          const viewPromise = layer.view.load().then((mod) => {
            // Overwrite the layer's view permanently so it doesn't fetch again.
            layer.view = "default" in mod ? mod.default : mod;
          });
          tasks.push(viewPromise);
        }
      });

      let caughtError: Error | null = null;
      let errorLayerIndex = -1;

      // Track loading progress.
      const totalTasks = tasks.length;
      if (totalTasks > 0) {
        progress(0.1);
        let completed = 0;

        tasks.forEach((p) => {
          p.then(() => {
            completed++;
            progress(0.1 + (completed / totalTasks) * 0.8);
          }).catch(() => {}); // Errors handled by Promise.all below.
        });
      }

      // Await code and data.
      try {
        await Promise.all(tasks);
      } catch (error) {
        progress(0);

        if (error instanceof RedirectError) {
          api.replace(error.redirectPath);
          return;
        }

        caughtError = error instanceof Error ? error : new Error(String(error));
        errorLayerIndex = divergenceIndex;
      }

      // Merge query params.
      const query = mergeQueryParams(peek(currentMatch).query, match.query, options.preserveQuery);

      const queryString = query.toString();
      const searchString = queryString.length > 0 ? "?" + queryString : "";

      // Update the URL if matched path differs from navigator path.
      // This happens if route resolution involved redirects.
      if (match.path !== history.getPath() || searchString !== history.getSearch()) {
        history.replace(match.path + searchString);
      }

      // Run in batch so all new layers are mounted simultaneously with match signal change.
      // This avoids the old route effects receiving new signal values just before they unmount.
      batch(() => {
        currentMatch({ ...match, query: Object.fromEntries(query) });

        // If nothing actually diverged (e.g. just a query param change), we are done.
        if (divergenceIndex === layers.length && activeLayers.length === layers.length) {
          return;
        }

        // Unmount old layers from the divergence point downwards.
        const firstDiscardedLayer = activeLayers[divergenceIndex];
        if (firstDiscardedLayer) {
          firstDiscardedLayer.node.unmount();
          activeLayers.splice(divergenceIndex);
        }

        // Mount new layers.
        for (let i = divergenceIndex; i < layers.length; i++) {
          const currentLayer = layers[i];
          const parentLayer = activeLayers[i - 1] ?? rootLayer;
          const slot = state<MarkupNode>();

          let viewToMount = currentLayer.view as View<any>;
          let propsToPass: any = {
            data: preloadedData[i - divergenceIndex],
            children: createMarkup("$dynamic", { slot }),
          };

          // If we hit an error, mount the errorView instead of the standard view
          if (caughtError && i === errorLayerIndex) {
            if (currentLayer.errorView) {
              viewToMount = currentLayer.errorView;
              propsToPass = { error: caughtError };
            } else {
              // If no errorView is defined, let it bubble up to the nearest ErrorBoundaryNode
              throw caughtError;
            }
          }

          const node = new ViewNode(parentLayer.context, viewToMount, propsToPass);
          parentLayer.slot(node);

          activeLayers.push({
            id: currentLayer.id,
            key: layerKeys[i],
            node,
            context: node.context,
            slot,
          });

          // Stop mounting deeper layers if we hit an error boundary layer
          if (caughtError && i === errorLayerIndex) break;
        }
      });

      progress(0);

      // Restore the scroll position of the page we are entering.
      requestAnimationFrame(() => {
        const targetScroll = scrollCache.get(history.getKey()) ?? 0;
        window.scrollTo(0, targetScroll);

        currentKey = history.getKey();
      });
    }

    const api = provide(this, RouterStore, {
      currentMatch,
      progress,
      history,
      updateRoute,
    });

    // Listen for `popstate` events and update route accordingly.
    onMount(this, () => {
      const onPopState = () => updateRoute(undefined, true);
      window.addEventListener("popstate", onPopState);
      onCleanup(this, () => window.removeEventListener("popstate", onPopState));
    });

    // Intercept clicks on `<a>` tags within the app.
    onMount(this, () => {
      const parentElement = context[PARENT_ELEMENT] as Element;
      const stop = catchLinks(parentElement, (path) => {
        api.push(path);
      });
      onCleanup(this, stop);
    });

    updateRoute();

    return rootLayer.node;
  };
}

export class NoRouteError extends Error {}

/**
 * Triggers a redirect if thrown within a preload function.
 */
export class RedirectError extends Error {
  constructor(public redirectPath: string) {
    super(`Redirecting to ${redirectPath}`);
    this.name = "RedirectError";
  }
}
