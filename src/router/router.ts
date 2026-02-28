import { $$context, $debug, $provide, $setup } from "../core/hooks.js";
import { DynamicNode } from "../core/markup/nodes/dynamic.js";
import { ViewNode } from "../core/markup/nodes/view.js";
import type { MarkupNode } from "../core/markup/types.js";
import { createMarkup } from "../core/markup/utils.js";
import { batch, state } from "../core/reactive.js";
import { PARENT_ELEMENT } from "../core/symbols.js";
import { isArray, isFunction, isObject, isString } from "../typeChecking.js";
import type { View } from "../types.js";
import { IdGenerator } from "../utils.js";
import { RouterStore } from "./store.js";
import type {
  ActiveLayer,
  JourneyStep,
  Route,
  RouteLayer,
  RouteMeta,
  RouteRedirectContext,
  RouterOptions,
} from "./types.js";
import {
  catchLinks,
  joinPath,
  matchRoutes,
  patternToFragments,
  replaceParams,
  resolvePath,
  sortRoutes,
  splitPath,
  type ParsedRoute,
  type RouteMatch,
} from "./utils.js";

export function createRouter(options: RouterOptions): View {
  // TODO: Cleanup. Making sure we capture the query params immediately before any routing takes place.
  // Query params are part of the hash if using hash routing.

  const initialQuery: Record<string, string> = {};
  const _initialQ = new URLSearchParams(options.hash ? window.location.hash.split("?")[1] : window.location.search);
  for (const [key, value] of _initialQ.entries()) {
    initialQuery[key] = value;
  }

  const match = state<RouteMatch>({
    path: options.hash ? window.location.hash.split("?")[0] : window.location.pathname,
    pattern: "",
    params: {},
    query: initialQuery,
    meta: {},
  });

  const routeIds = new IdGenerator();

  // Process routes.
  const routes = sortRoutes(
    options.routes
      .flatMap((route) => prepareRoute(routeIds, route))
      .map((route) => ({
        pattern: route.pattern,
        meta: route.meta,
        fragments: patternToFragments(route.pattern),
      })),
  );
  assertValidRedirects(routes);

  return function RouterView() {
    const context = $$context();
    context.setName("dolla:router");

    const debug = $debug();

    const layerIds = new IdGenerator();

    const rootSlot = state<MarkupNode>();
    const rootLayer = {
      id: layerIds.next(),
      node: new DynamicNode(context, rootSlot),
      context,
      slot: rootSlot,
    };
    const activeLayers: ActiveLayer[] = [];

    /**
     * Run when the location changes. Diffs and mounts new routes and updates
     * the $path, $route, $params and $query states accordingly.
     */
    async function updateRoute(href?: string | undefined) {
      const url = href ? new URL(href, window.location.origin) : getCurrentURL(options);

      const route = await resolveRoute(routes, url);

      for (let i = 0; i < route.journey.length; i++) {
        const step = route.journey[i];
        const tag = `(update: step ${i + 1} of ${route.journey.length})`;

        switch (step.kind) {
          case "match":
            debug.info(`${tag} 📍 ${step.message}`);
            break;
          case "redirect":
            debug.info(`${tag} ↩️ ${step.message}`);
            break;
          case "miss":
            debug.info(`${tag} 💀 ${step.message}`);
            break;
          default:
            break;
        }
      }

      if (!route.match) {
        throw new NoRouteError(`Failed to match route '${url.pathname}'`);
      }

      // Merge query params.
      let query = route.match.query;
      const queryParams = new URLSearchParams();

      if (options.preserveQuery === true) {
        query = Object.assign({}, match.get()?.query ?? {}, route.match.query);
      } else if (isArray(options.preserveQuery)) {
        const preserved: Record<string, any> = {};
        const current = match.get()?.query ?? {};
        for (const key in current) {
          if (options.preserveQuery.includes(key)) {
            preserved[key] = current[key];
          }
        }
        query = Object.assign({}, preserved, route.match.query);
      }

      for (const key in query) {
        queryParams.set(key, query[key]);
      }

      const queryString = queryParams.size > 0 ? "?" + queryParams.toString() : "";

      // Update the URL if matched path differs from navigator path.
      // This happens if route resolution involved redirects.
      if (route.match.path !== location.pathname || location.search !== queryString) {
        window.history.replaceState(
          null,
          "",
          options.hash ? "/#" + route.match.path + queryString : route.match.path + queryString,
        );
      }

      const routeMatch = route.match!;

      // Run in batch so all new layers are mounted simultaneously with match signal change.
      // This avoids the old route effects receiving new signal values just before they unmount.
      batch(() => {
        match.set({ ...routeMatch, query });

        const layers = routeMatch.meta.layers!;

        // Diff and update route layers.
        for (let i = 0; i < layers.length; i++) {
          const currentLayer = layers[i];
          const previousLayer = activeLayers[i];

          if (previousLayer?.id !== currentLayer.id) {
            const parentLayer = activeLayers[i - 1] ?? rootLayer;

            // Create a slot and element for this layer.
            const slot = state<MarkupNode>();
            const node = new ViewNode(parentLayer.context, currentLayer.view, {
              children: createMarkup("$dynamic", { slot: slot }),
            });

            // Discard all previously active layers starting at this depth.
            activeLayers.splice(i);

            // Add new layer to activeLayers.
            activeLayers.push({
              id: currentLayer.id,
              node,
              context: node.context,
              slot,
            });

            previousLayer?.node.unmount();

            parentLayer.slot.set(node);

            // TODO: Handle $preload()

            // All preloads for newly matched layers should fire simultaneously.
            // Then when all are done the layers should mount at once.

            // node._routePreload().then(() => {
            //   console.log("preloaded", parentLayer, node);

            // });
          }
        }
      });

      return route;
    }

    const api = $provide(RouterStore, { match, options, updateRoute });

    // Listen for `popstate` events and update route accordingly.
    $setup(() => {
      const onPopState = () => updateRoute();
      window.addEventListener("popstate", onPopState);
      return () => window.removeEventListener("popstate", onPopState);
    });

    // Intercept clicks on `<a>` tags within the app.
    $setup(() => {
      const parentElement = context.state[PARENT_ELEMENT] as Element;
      return catchLinks(parentElement, (path) => {
        api.push(path);
      });
    });

    $setup(() => {
      updateRoute();
    });

    return rootLayer.node;
  };
}

function getCurrentURL(options: RouterOptions): URL {
  if (options.hash) {
    return new URL(window.location.hash.slice(1), window.location.origin);
  } else {
    return new URL(window.location.pathname, window.location.origin);
  }
}

/**
 * Parses a route definition object into a set of matchable routes.
 *
 * @param route - Route config object.
 * @param layers - Array of parent layers. Passed when this function calls itself on nested routes.
 */
function prepareRoute(ids: IdGenerator, route: Route, parents: Route[] = [], layers: RouteLayer[] = []) {
  if (!isObject(route) || !isString(route.path)) {
    throw new TypeError(`Route configs must be objects with a 'path' string property. Got: ${route}`);
  }

  if (route.redirect && route.routes) {
    throw new Error(`Route cannot have both a 'redirect' and nested 'routes'.`);
  } else if (route.redirect && route.view) {
    throw new Error(`Route cannot have both a 'redirect' and a 'view'.`);
  } else if (!route.view && !route.routes && !route.redirect) {
    throw new Error(`Route must have a 'view', a 'redirect', or a set of nested 'routes'.`);
  }

  let parts: string[] = [];

  for (const parent of parents) {
    parts.push(...splitPath(parent.path));
  }

  parts.push(...splitPath(route.path));

  // Remove trailing wildcard for joining with nested routes.
  if (parts[parts.length - 1] === "*") {
    parts.pop();
  }

  const routes: ParsedRoute<RouteMeta>[] = [];

  if (route.redirect) {
    let redirect = route.redirect;

    if (isString(redirect)) {
      redirect = resolvePath(joinPath(parts), redirect);

      if (!redirect.startsWith("/")) {
        redirect = "/" + redirect;
      }
    }

    const pattern = "/" + joinPath([...parts, ...splitPath(route.path)]);

    routes.push({
      pattern,
      meta: { redirect },
      fragments: patternToFragments(pattern),
    });

    return routes;
  }

  let view: View<any> = (props: any) => props.children;

  if (isFunction(route.view)) {
    view = route.view;
  } else if (route.view) {
    throw new TypeError(`Route '${route.path}' expected a view function or undefined. Got: ${route.view}`);
  }

  const layer: RouteLayer = { id: ids.next(), view };

  // Parse nested routes if they exist.
  if (route.routes) {
    for (const subroute of route.routes) {
      routes.push(...prepareRoute(ids, subroute, [...parents, route], [...layers, layer]));
    }
  } else {
    const pattern = parents.length ? joinPath([...parents.map((p) => p.path), route.path]) : route.path;
    const config: ParsedRoute<RouteMeta> = {
      pattern,
      meta: {
        pattern: route.path,
        layers: [...layers, layer],
        // Store the layer ID with each beforeMatch so we can correlate which context needs to get any state that is set.
        // beforeMatch: parents
        //   .flatMap((parent, i) => (parent.beforeMatch ? { fn: parent.beforeMatch, layerId: layers[i].id } : null))
        //   .concat(route.beforeMatch ? { fn: route.beforeMatch, layerId: layer.id } : null)
        //   .filter((x) => x != null),
      },
      fragments: patternToFragments(pattern),
    };
    if (route.meta) {
      const parent = parents.at(-1);
      if (parent) {
        config.meta.data = { ...parent.meta, ...route.meta };
      } else {
        config.meta.data = route.meta;
      }
    }
    routes.push(config);
  }

  return routes;
}

/**
 * Takes a URL and finds a match, following redirects.
 */
async function resolveRoute<M extends RouteMeta>(
  routes: ParsedRoute<M>[],
  url: URL,
  journey: JourneyStep[] = [],
): Promise<{
  match: RouteMatch<RouteMeta> | null;
  journey: JourneyStep[];
}> {
  return new Promise((resolve, reject) => {
    const match = matchRoutes(routes, url.pathname);

    if (!match) {
      return resolve({
        match: null,
        journey: [...journey, { kind: "miss", message: `no match for '${url.pathname}'` }],
      });
    }

    let redirect = match.meta.redirect;

    const finalize = async () => {
      if (redirect != null) {
        let path: string;

        if (isString(redirect)) {
          path = replaceParams(redirect, match.params);
        } else if (isFunction(redirect)) {
          const redirectContext: RouteRedirectContext = {
            path: match.path,
            pattern: match.pattern,
            params: match.params,
            query: match.query,
            meta: match.meta.data ?? {},
          };
          path = await redirect(redirectContext);
          if (!isString(path)) {
            return reject(new Error(`Redirect function must return a path to redirect to.`));
          }
          if (!path.startsWith("/")) {
            // Not absolute. Resolve against matched path.
            path = resolvePath(match.path, path);
          }
        } else {
          return reject(new TypeError(`Redirect must either be a path string or a function.`));
        }

        resolve(
          resolveRoute(routes, new URL(path, window.location.origin), [
            ...journey,
            { kind: "redirect", message: `redirecting '${match.path}' -> '${path}'` },
          ]),
        );
      } else {
        resolve({ match, journey: [...journey, { kind: "match", message: `matched route '${match.path}'` }] });
      }
    };

    // if (match.meta.beforeMatch?.length) {
    //   const callbacks = match.meta.beforeMatch;
    //   let i = -1;
    //   const next = () => {
    //     i++;
    //     if (i === callbacks.length) {
    //       // Mount route
    //       finalize();
    //     } else {
    //       // Next callback
    //       let finalized = false;
    //       const result = callbacks[i].fn({
    //         path: match.path,
    //         pattern: match.pattern,
    //         params: match.params,
    //         query: match.query,
    //         meta: match.meta.data ?? {},

    //         redirect: (path) => {
    //           redirect = path;
    //           finalized = true;
    //           finalize();
    //         },
    //       });
    //       if (!finalized) {
    //         if (result instanceof Promise) {
    //           result.then(next);
    //         } else {
    //           next();
    //         }
    //       }
    //     }
    //   };

    //   next();

    //   // TODO: Show warning after timeout if next hasn't been called?
    // } else {
    finalize();
    // }
  });
}

function assertValidRedirects(routes: ParsedRoute<RouteMeta>[]) {
  // Test redirects to make sure all possible redirect targets actually exist.
  for (const route of routes) {
    if (route.meta.redirect) {
      let redirectPath: string;

      if (isFunction(route.meta.redirect)) {
        // throw new Error(`Redirect functions are not yet supported.`);
        // Just allow, though it could fail later. Best not to call the function and cause potential side effects.
      } else if (isString(route.meta.redirect)) {
        redirectPath = route.meta.redirect;

        const match = matchRoutes(routes, redirectPath, {
          willMatch(r) {
            return r !== route;
          },
        });

        if (!match) {
          throw new Error(`Found a redirect to an undefined URL. From '${route.pattern}' to '${route.meta.redirect}'`);
        }
      } else {
        throw new TypeError(`Expected a string or redirect function. Got: ${route.meta.redirect}`);
      }
    }
  }
}

class NoRouteError extends Error {}
