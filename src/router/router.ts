import { Context } from "../core/context.js";
import { createLogger } from "../core/logger.js";
import { m, MarkupType, type MarkupNode } from "../core/markup.js";
import { DynamicNode } from "../core/nodes/dynamic.js";
import { ViewNode } from "../core/nodes/view.js";
import { writable, memo, batch, untracked, type Writable, type Signal } from "../core/signals.js";
import { assertObject, isArray, isArrayOf, isFunction, isObject, isString } from "../typeChecking.js";
import type { View } from "../types.js";
import { deepEqual, shallowEqual } from "../utils.js";
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
   * Merged `data` from all matched layers are available from `router.$match()`.
   */
  data: Record<string, any>;
}

export interface RouteMatchContext extends Match {
  /**
   * Stores `value` at `key` in this context's state.
   */
  setState<T>(key: any, value: T): void;

  /**
   * For each tuple in `entries`, stores `value` at `key` in this context's state.
   */
  setState(entries: [key: any, value: any][]): void;

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
   * Called after the match is identified but before it is acted on. Use this to set state, load data, etc.
   */
  beforeMatch?: (ctx: RouteMatchContext) => void | Promise<void>;

  /**
   * Arbitrary data you'd like to store on this route.
   * This object will be available at `router.$match` while the route is active.
   *
   * In the case of nested routes, data from all layers will be merged into a single data object.
   */
  data?: Record<string, any>;
}

export interface RouteMeta {
  redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);
  pattern?: string;
  layers?: RouteLayer[];
  beforeMatch?: { fn: (ctx: RouteMatchContext) => void | Promise<void>; layerId: number }[];
  data?: Record<string, any>;
}

export interface RouteConfig {
  pattern: string;
  meta: RouteMeta;
}

export interface RouteLayer {
  id: number;
  view: View<{}>;
}

/**
 * An active route layer whose markup has been initialized into a view.
 */
interface ActiveLayer {
  id: number;
  node: MarkupNode;
  context: Context;
  $slot: Writable<MarkupNode | undefined>;
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
   * Replace the current item in the history stack instead of adding a new one.
   * The back button will send the user to the page they visited before this. Defaults to false.
   */
  replace?: boolean;

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

// ----- Code ----- //

export const ROUTER = Symbol("Router");
export const MOUNT = Symbol();
export const UNMOUNT = Symbol();
export const ROOT_VIEW = Symbol();

export class Router {
  #logger = createLogger("dolla.router");

  #nextLayerId = 0;
  #activeLayers: ActiveLayer[] = [];
  #routes: ParsedRoute<RouteMeta>[] = [];

  #isMounted = false;

  #rootLayer!: ActiveLayer;

  /**
   * Use hash routing when true. Configured in router options.
   */
  #hash = false;

  /**
   * Cleanup functions to call on unmount.
   */
  #cleanup: (() => void)[] = [];

  /**
   * The current match object (internal).
   */
  #match = writable<RouteMatch>();

  /**
   * The current match object.
   */
  readonly $match = memo<Match | undefined>(
    () => {
      const match = this.#match();
      if (match) {
        return {
          path: match.path,
          pattern: match.pattern,
          params: { ...match.params },
          query: { ...match.query },
          data: match.meta.data ?? {},
        };
      }
    },
    { equals: deepEqual },
  );

  /**
   * The currently matched route pattern, if any.
   */
  readonly $pattern = memo(() => this.#match()?.pattern);

  /**
   * The current URL path.
   */
  readonly $path = memo(() => this.#match()?.path ?? window.location.pathname);

  /**
   * The current named path params.
   */
  readonly $params = memo(() => this.#match()?.params ?? {}, { equals: shallowEqual });

  /**
   * The current query params.
   */
  readonly $query = memo(() => this.#match()?.query ?? {}, { equals: shallowEqual });

  constructor(options: RouterOptions) {
    assertObject(options, "Options must be an object. Got: %t");

    if (options.hash) {
      this.#hash = true;
    }

    // Add routes.
    this.#routes = sortRoutes(
      options.routes
        .flatMap((route) => this.#prepareRoute(route))
        .map((route) => ({
          pattern: route.pattern,
          meta: route.meta,
          fragments: patternToFragments(route.pattern),
        })),
    );

    assertValidRedirects(this.#routes);
  }

  async [MOUNT](parent: Element, context: Context): Promise<MarkupNode> {
    const $slot = writable<MarkupNode>();
    this.#rootLayer = {
      id: this.#nextLayerId++,
      node: new DynamicNode(context, $slot),
      context,
      $slot,
    };

    // Listen for popstate events and update route accordingly.
    const onPopState = () => this.#updateRoute();
    window.addEventListener("popstate", onPopState);
    this.#cleanup.push(() => window.removeEventListener("popstate", onPopState));

    // Listen for clicks on <a> tags within the app.
    this.#cleanup.push(
      catchLinks(parent, (anchor) => {
        this.#logger.info("intercepted click on <a> tag", anchor);

        const href = anchor.getAttribute("href")!;
        const preserveQuery = anchor.getAttribute("data-router-preserve-query");

        this.go(href, {
          preserveQuery: parsePreserveQueryAttribute(preserveQuery),
        });
      }),
    );
    this.#logger.info("will intercept clicks on <a> tags within parent element:", parent);

    this.#isMounted = true;

    // Mount initial route.
    await this.#updateRoute();

    return this.#rootLayer.node;
  }

  async [UNMOUNT]() {
    for (const callback of this.#cleanup) {
      callback();
    }
    this.#cleanup.length = 0;
  }

  /**
   * Navigate backward. Pass a number of steps to hit the back button that many times.
   */
  back(steps = 1) {
    window.history.go(-steps);
  }

  /**
   * Navigate forward. Pass a number of steps to hit the forward button that many times.
   */
  forward(steps = 1) {
    window.history.go(steps);
  }

  /**
   * Navigates to another route.
   *
   * @example
   * router.go("/login"); // navigate to `/login`
   * router.go["/users", 215], { replace: true }); // replace current history entry with `/users/215`
   */
  go(path: Stringable | Stringable[], options: NavigateOptions = {}) {
    let joined: string;

    if (Array.isArray(path)) {
      joined = joinPath(path);
    } else {
      joined = path.toString();
    }

    joined = resolvePath(window.location.pathname, joined);

    if (options.replace) {
      this.#replace(joined, options);
    } else {
      this.#push(joined, options);
    }
  }

  /**
   * Updates query params, keeping existing ones and applying new ones. Removes the query param if value is set to `null`.
   */
  updateQuery(values: Record<string, Stringable | null>) {
    const match = untracked(this.#match)!;
    const query = { ...this.$query() };

    for (const key in values) {
      const value = values[key];
      if (value === null) {
        delete query[key];
      } else {
        query[key] = value.toString();
      }
    }

    let queryParts: string[] = [];

    for (const key in query) {
      queryParts.push(`${key}=${query[key]}`);
    }
    const queryString = queryParts.length > 0 ? "?" + queryParts.join("&") : "";

    this.#match.set({ ...match, query });

    window.history.replaceState(null, "", this.#hash ? "/#" + match.path + queryString : match.path + queryString);
  }

  #push(href: string, options: NavigateOptions) {
    this.#logger.info("(push)", href);

    window.history.pushState(null, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href, options);
  }

  #replace(href: string, options: NavigateOptions) {
    this.#logger.info("(replace)", href);

    window.history.replaceState(null, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href, options);
  }

  #getCurrentURL(): URL {
    if (this.#hash) {
      return new URL(window.location.hash.slice(1), window.location.origin);
    } else {
      return new URL(window.location.pathname, window.location.origin);
    }
  }

  /**
   * Run when the location changes. Diffs and mounts new routes and updates
   * the $path, $route, $params and $query states accordingly.
   */
  async #updateRoute(href?: string | undefined, options: NavigateOptions = {}) {
    const logger = this.#logger;
    const url = href ? new URL(href, window.location.origin) : this.#getCurrentURL();

    const { match, journey, state } = await this.#resolveRoute(url);

    for (let i = 0; i < journey.length; i++) {
      const step = journey[i];
      const tag = `(update: step ${i + 1} of ${journey.length})`;

      switch (step.kind) {
        case "match":
          logger?.info(`${tag} 📍 ${step.message}`);
          break;
        case "redirect":
          logger?.info(`${tag} ↩️ ${step.message}`);
          break;
        case "miss":
          logger?.info(`${tag} 💀 ${step.message}`);
          break;
        default:
          break;
      }
    }

    if (!match) {
      // Only crash if routing has been configured.
      if (this.#isMounted) {
        throw logger.crash(new NoRouteError(`Failed to match route '${url.pathname}'`));
      }
      return;
    }

    // Merge query params.
    let query = match.query;
    let queryParts: string[] = [];

    if (options.preserveQuery === true) {
      query = Object.assign({}, this.$query(), match.query);
    } else if (isArray(options.preserveQuery)) {
      const preserved: Record<string, any> = {};
      const current = this.$query();
      for (const key in current) {
        if (options.preserveQuery.includes(key)) {
          preserved[key] = current[key];
        }
      }
      query = Object.assign({}, preserved, match.query);
    }

    for (const key in query) {
      queryParts.push(`${key}=${query[key]}`);
    }
    const queryString = queryParts.length > 0 ? "?" + queryParts.join("&") : "";

    // Update the URL if matched path differs from navigator path.
    // This happens if route resolution involved redirects.
    if (match.path !== location.pathname || location.search !== queryString) {
      window.history.replaceState(null, "", this.#hash ? "/#" + match.path + queryString : match.path + queryString);
    }

    // Run in batch so all new layers are mounted simultaneously with match signal change.
    // This avoids the old route effects receiving new signal values just before they unmount.
    batch(() => {
      const oldPattern = untracked(this.$pattern);

      this.#match.set({ ...match, query });

      if (match.pattern === oldPattern) {
        // If pattern has not changed, update state on current layers.
        for (const layer of this.#activeLayers) {
          const stateEntries = state.get(layer.id);
          if (stateEntries) {
            layer.context.setState(stateEntries);
          }
        }
        return;
      }

      const layers = match.meta.layers!;
      logger.info("mounting", match);

      // Diff and update route layers.
      for (let i = 0; i < layers.length; i++) {
        const matchedLayer = layers[i];
        const activeLayer = this.#activeLayers[i];

        if (activeLayer?.id !== matchedLayer.id) {
          // Discard all previously active layers starting at this depth.
          this.#activeLayers = this.#activeLayers.slice(0, i);
          activeLayer?.node.unmount();

          const parentLayer = this.#activeLayers.at(-1) ?? this.#rootLayer;

          // Create a $slot and element for this layer.
          const $slot = writable<MarkupNode>();
          const node = new ViewNode(parentLayer.context, matchedLayer.view, {
            children: m(MarkupType.Dynamic, { source: $slot }),
          });

          // Set state for new layer.
          const stateEntries = state.get(matchedLayer.id);
          if (stateEntries) {
            node.context.setState(stateEntries);
          }

          // TODO: Handle route suspense. Route views should be able to suspend route mounting until they have loaded their data.

          // const routeLoader = {
          //   next() {},
          //   error(err: Error) {},
          // };
          // node.context.setState("ROUTE_LOADER", routeLoader);
          // TODO: Views will look for a ROUTE_LOADER on their own context and call next() on it if they find it.
          // This will complete the mounting of the route.

          // Add new layer to activeLayers.
          this.#activeLayers.push({
            id: matchedLayer.id,
            node,
            context: node.context,
            $slot: $slot,
          });

          // Slot this layer into parent.
          parentLayer.$slot.set(node);
        } else {
          // Update state for layers that are still active.
          const stateEntries = state.get(activeLayer.id);
          if (stateEntries) {
            activeLayer.context.setState(stateEntries);
          }
        }
      }
    });

    return { match, journey };
  }

  /**
   * Takes a URL and finds a match, following redirects.
   */
  async #resolveRoute(
    url: URL,
    journey: JourneyStep[] = [],
    state = new Map<number, [any, any][]>(),
  ): Promise<{
    match: RouteMatch<RouteMeta> | null;
    journey: JourneyStep[];
    state: Map<number, [any, any][]>; // map of layerId to state entries
  }> {
    return new Promise((resolve, reject) => {
      const match = matchRoutes(this.#routes, url.pathname);

      if (!match) {
        return resolve({
          match: null,
          journey: [...journey, { kind: "miss", message: `no match for '${url.pathname}'` }],
          state,
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
              data: match.meta.data ?? {},
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
            this.#resolveRoute(new URL(path, window.location.origin), [
              ...journey,
              { kind: "redirect", message: `redirecting '${match.path}' -> '${path}'` },
            ]),
          );
        } else {
          resolve({ match, journey: [...journey, { kind: "match", message: `matched route '${match.path}'` }], state });
        }
      };

      if (match.meta.beforeMatch?.length) {
        const callbacks = match.meta.beforeMatch;
        let i = -1;
        const next = () => {
          i++;
          if (i === callbacks.length) {
            // Mount route
            finalize();
          } else {
            // Next callback
            let finalized = false;
            const result = callbacks[i].fn({
              path: match.path,
              pattern: match.pattern,
              params: match.params,
              query: match.query,
              data: match.meta.data ?? {},

              setState: (...args: any[]) => {
                const id = callbacks[i].layerId;
                const entries: [any, any][] = [];

                if (args.length === 1 && isArrayOf(isArray, args[0])) {
                  entries.push(...(args[0] as [any, any][]));
                } else if (args.length === 2) {
                  entries.push([args[0], args[1]]);
                } else {
                  throw new Error("Invalid arguments.");
                }

                const current = state.get(id);
                if (!current) {
                  state.set(id, entries);
                } else {
                  entries.push(...entries);
                }
              },

              redirect: (path) => {
                redirect = path;
                finalized = true;
                finalize();
              },
            });
            if (!finalized) {
              if (result instanceof Promise) {
                result.then(next);
              } else {
                next();
              }
            }
          }
        };

        next();

        // TODO: Show warning after timeout if next hasn't been called?
      } else {
        finalize();
      }
    });
  }

  /**
   * Parses a route definition object into a set of matchable routes.
   *
   * @param route - Route config object.
   * @param layers - Array of parent layers. Passed when this function calls itself on nested routes.
   */
  #prepareRoute(route: Route, parents: Route[] = [], layers: RouteLayer[] = []) {
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

    const routes: RouteConfig[] = [];

    if (route.redirect) {
      let redirect = route.redirect;

      if (isString(redirect)) {
        redirect = resolvePath(joinPath(parts), redirect);

        if (!redirect.startsWith("/")) {
          redirect = "/" + redirect;
        }
      }

      const config: RouteConfig = {
        pattern: "/" + joinPath([...parts, ...splitPath(route.path)]),
        meta: {
          redirect,
        },
      };
      routes.push(config);

      return routes;
    }

    let view: View<any> = (props: any) => props.children;

    if (isFunction(route.view)) {
      view = route.view;
    } else if (route.view) {
      throw new TypeError(`Route '${route.path}' expected a view function or undefined. Got: ${route.view}`);
    }

    const layer: RouteLayer = { id: this.#nextLayerId++, view };

    // Parse nested routes if they exist.
    if (route.routes) {
      for (const subroute of route.routes) {
        routes.push(...this.#prepareRoute(subroute, [...parents, route], [...layers, layer]));
      }
    } else {
      const config: RouteConfig = {
        pattern: parents.length ? joinPath([...parents.map((p) => p.path), route.path]) : route.path,
        meta: {
          pattern: route.path,
          layers: [...layers, layer],
          // Store the layer ID with each beforeMatch so we can correlate which context needs to get any state that is set.
          beforeMatch: parents
            .flatMap((parent, i) => (parent.beforeMatch ? { fn: parent.beforeMatch, layerId: layers[i].id } : null))
            .concat(route.beforeMatch ? { fn: route.beforeMatch, layerId: layer.id } : null)
            .filter((x) => x != null),
        },
      };
      if (route.data) {
        const parent = parents.at(-1);
        if (parent) {
          config.meta.data = { ...parent.data, ...route.data };
        } else {
          config.meta.data = route.data;
        }
      }
      routes.push(config);
    }

    return routes;
  }
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

/**
 * Parses the data-router-preserve-query attribute from a link.
 */
function parsePreserveQueryAttribute(value: null | string | boolean): boolean | string[] {
  if (value === null) {
    return false;
  } else if (value === true || value === false) {
    return value;
  } else if (typeof value === "string") {
    value = value.trim();
    if (value === "" || value === "true") {
      return true;
    } else if (value === "false") {
      return false;
    }

    return value
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k.length > 0);
  } else {
    throw new Error(`Invalid type for data-router-preserve-query attribute: ${typeof value} (value: ${value})`);
  }
}

class NoRouteError extends Error {}
