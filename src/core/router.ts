import { isFunction, isObject, isString } from "../typeChecking.js";
import type { View } from "../types.js";
import { IdGenerator, shallowEqual } from "../utils.js";
import { PARENT_ELEMENT } from "./app.js";
import { Context } from "./context.js";
import { $$context, $debug, $provide, $setup } from "./hooks.js";
import { Markup, MarkupType, type MarkupNode } from "./markup.js";
import { DynamicNode } from "./nodes/dynamic.js";
import { ViewNode } from "./nodes/view.js";
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
} from "./router.utils.js";
import { batch, computed, Readable, state, type Writable } from "./signal.js";

// ----- Types ----- //

export type Stringable = { toString(): string };

export interface Match {
  /**
   * The path as it appears in the URL bar.
   */
  path: string;

  /**
   * The pattern that this path was matched with.
   */
  pattern: string;

  /**
   * Named route params parsed from `path`.
   */
  params: Record<string, string>;

  /**
   * Query params parsed from `path`.
   */
  query: Record<string, string>;

  /**
   * Freeform data you wish to store with this route.
   * Merged `data` from all matched layers are available on the router's `match.meta`.
   */
  meta: Record<string, any>;
}

export interface RouteMatchContext extends Match {
  /**
   * Redirects the user to a different route instead of matching the current one.
   */
  redirect(path: string): void;
}

export interface GuardState extends Match {
  /**
   * Redirects the user to a different route instead of matching the current one.
   */
  redirect(path: string): void;
}

export interface Route {
  /**
   * The path or path fragment to match.
   */
  path: string;

  /**
   * Path to redirect to when this route is matched, or a callback function that returns such path.
   */
  redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);

  /**
   * View to display when this route is matched.
   */
  view?: View<any>;

  /**
   * Subroutes.
   */
  routes?: Route[];

  /**
   * Arbitrary data you'd like to store on this route.
   * This object is accessible via `match.meta` on the `$router` API while the route is active.
   *
   * In the case of nested routes, data from all layers will be merged into a single data object.
   */
  meta?: Record<string, any>;
}

export interface RouteMeta {
  redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);
  pattern?: string;
  layers?: RouteLayer[];
  guard?: { fn: (ctx: RouteMatchContext) => void | Promise<void>; layerId: string }[];
  data?: Record<string, any>;
}

export interface RouteLayer {
  id: string;
  view: View<{}>;
}

export interface RoutePreloadState {
  // Info passed to preload functions
}

export type RoutePreloadFn = (state: RoutePreloadState) => Promise<void>;

export interface RouteTransitionState {
  // Info passed to transition functions
}

export interface RouteTransitions {
  in?: (state: RouteTransitionState) => Promise<void>;
  out?: (state: RouteTransitionState) => Promise<void>;
}

/**
 * An active route layer whose markup has been initialized into a view.
 */
interface ActiveLayer {
  id: string;
  node: MarkupNode;
  context: Context;
  slot: Writable<MarkupNode | undefined>;
}

/**
 * Object passed to redirect callbacks. Contains information useful for determining how to redirect.
 */
export interface RouteRedirectContext extends Match {}

/**
 * A log for a single step in the route resolution process.
 */
interface JourneyStep {
  kind: "match" | "redirect" | "miss";
  message: string;
}

export interface NavigateOptions {
  /**
   * Preserve existing query params (if any) when navigating. Defaults to false.
   * If true, all existing query params are preserved and merged with new ones.
   * If an array of strings is passed only those keys will be preserved, then merged with any new ones.
   */
  preserveQuery?: boolean | string[];
}

export interface RouterOptions {
  routes: Route[];

  /**
   * When true, the router will construct routes like "https://www.example.com/#/sub/route" which work without any backend intervention.
   */
  hash?: boolean;
}

export interface RouterAPI {
  /**
   * Info about the currently matched route.
   */
  match: {
    /**
     * The current path as it is displayed in the URL bar (e.g. `/users/123/edit`).
     */
    path: Readable<string>;
    /**
     * The route pattern that was matched (e.g. `/users/{#id}/edit`), or undefined if no route is currently matched.
     */
    pattern: Readable<string | undefined>;
    /**
     * The extracted route parameters from the path. (e.g. `{ id: "123" }`)
     */
    params: Readable<Record<string, string>>;
    /**
     * The current query params. This is a Writable object that lets you modify query params as well as read them.
     */
    query: QueryParams;
    /**
     * The contents of the `meta` fields of all matched route layers.
     */
    meta: Readable<Record<string, string>>;
  };

  /**
   * Go back in the page history. Equivalent to hitting the back button.
   * Steps is the number of times to hit the back button. The default is 1.
   */
  back(steps?: number): void;

  /**
   * Go forward in the page history. Equivalent to hitting the forward button.
   * Steps is the number of times to hit the forward button. The default is 1.
   */
  forward(steps?: number): void;

  /**
   * Push a new route into the page history and navigate to it.
   */
  push(path: string): void;

  /**
   * Replace the current route in the page history and navigate to it.
   */
  replace(path: string): void;
}

// ----- Code ----- //

class QueryParams implements Writable<Record<string, string>> {
  #match: Writable<RouteMatch | undefined>;
  #options: RouterOptions;
  #params: Readable<Record<string, string>>;

  constructor(match: Writable<RouteMatch | undefined>, options: RouterOptions) {
    this.#match = match;
    this.#options = options;
    this.#params = computed(() => this.#match.track()?.query ?? {}, { equals: shallowEqual });
  }

  read() {
    return this.#params.read();
  }

  track() {
    return this.#params.track();
  }

  write(values: Record<string, string>) {
    const path = this.#match.read() ?? window.location.pathname;

    const params = new URLSearchParams();
    for (const key in values) {
      params.append(key, values[key]);
    }
    let queryString = params.toString();

    if (queryString.length > 0) {
      queryString = "?" + queryString;
    }

    this.#match.update((current) => ({ ...current!, query: values }));

    window.history.replaceState(null, "", this.#options.hash ? "/#" + path + queryString : path + queryString);

    return values;
  }

  update(callback: (current: Record<string, string>) => Record<string, string>) {
    const values = callback(this.read());
    return this.write(values);
  }

  /**
   * Applies `values` to the existing query params. `null` values will be removed.
   */
  patch(values: Record<string, string>): Record<string, string>;

  /**
   * Calls `callback` with existing query params. Applies the returned values to the existing query params. `null` values will be removed.
   */
  patch(callback: (current: Record<string, string>) => Record<string, string>): Record<string, string>;

  patch(valuesOrCallback: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) {
    const current = this.read();
    let values: Record<string, string>;

    if (isFunction<(current: Record<string, string>) => Record<string, string>>(valuesOrCallback)) {
      values = valuesOrCallback(current);
    } else {
      values = valuesOrCallback;
    }

    const merged = { ...current };
    for (const key in values) {
      if (values[key] === null) {
        delete merged[key];
      } else {
        merged[key] = values[key];
      }
    }
    return this.write(merged);
  }
}

export interface RouterStoreProps {
  match: Writable<RouteMatch | undefined>;
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

export function createRouter(options: RouterOptions): View {
  const match = state<RouteMatch>();

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

  // This is a view.
  // Mount it in your app like any other view. Probably at the root.
  return function router() {
    const context = $$context();
    context.setName("dolla:router");

    const layerIds = new IdGenerator();

    const rootSlot = state<MarkupNode>();
    const rootLayer = {
      id: layerIds.next(),
      node: new DynamicNode(context, rootSlot),
      context,
      slot: rootSlot,
    };
    const activeLayers: ActiveLayer[] = [];

    const debug = $debug();

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
        context.throwError(new NoRouteError(`Failed to match route '${url.pathname}'`));
        return;
      }

      // Merge query params.
      let query = route.match.query;
      const queryParams = new URLSearchParams();

      // if (options.preserveQuery === true) {
      //   query = Object.assign({}, this.query.read(), route.match.query);
      // } else if (isArray(options.preserveQuery)) {
      //   const preserved: Record<string, any> = {};
      //   const current = this.query.read();
      //   for (const key in current) {
      //     if (options.preserveQuery.includes(key)) {
      //       preserved[key] = current[key];
      //     }
      //   }
      //   query = Object.assign({}, preserved, route.match.query);
      // }

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
        match.write({ ...routeMatch, query });

        const layers = routeMatch.meta.layers!;
        debug.info("mounting", match);

        // Diff and update route layers.
        for (let i = 0; i < layers.length; i++) {
          const currentLayer = layers[i];
          const previousLayer = activeLayers[i];

          if (previousLayer?.id !== currentLayer.id) {
            const parentLayer = activeLayers[i - 1] ?? rootLayer;

            // Create a slot and element for this layer.
            const slot = state<MarkupNode>();
            const node = new ViewNode(parentLayer.context, currentLayer.view, {
              children: new Markup(MarkupType.Dynamic, { source: slot }),
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

            parentLayer.slot.write(node);

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
      const parentElement = context.getState<Element>(PARENT_ELEMENT)!;
      return catchLinks(parentElement, (path) => {
        api.push(path);
      });
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
