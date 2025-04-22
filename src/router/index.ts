import type { Dolla, Logger } from "../core/dolla.js";
import type { ViewElement, ViewFunction } from "../core/nodes/view.js";
import { atom, get, compose, type UnsubscribeFunction } from "../core/signals.js";
import { IS_ROUTER } from "../core/symbols.js";
import { assertObject, isArray, isFunction, isObject, isString, typeOf } from "../typeChecking.js";
import type { Stringable } from "../types.js";
import { shallowEqual } from "../utils.js";
import { Passthrough } from "../core/views/passthrough.js";
import {
  joinPath,
  matchRoutes,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
  catchLinks,
  replaceParams,
  type ParsedRoute,
  type RouteMatch,
} from "./router.utils.js";

// ----- Types ----- //

export interface RouteMatchContext {
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
  view?: ViewFunction<any>;

  /**
   * Subroutes.
   */
  routes?: Route[];

  /**
   * Called after the match is identified but before it is acted on. Use this to set state, load data, etc.
   */
  beforeMatch?: (ctx: RouteMatchContext) => void | Promise<void>;
}

export interface RouteMeta {
  redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);
  pattern?: string;
  layers?: RouteLayer[];
  beforeMatch?: (ctx: RouteMatchContext) => void | Promise<void>;
}

export interface RouteConfig {
  pattern: string;
  meta: RouteMeta;
}

export interface RouteLayer {
  id: number;
  view: ViewFunction<{}>;
}

/**
 * An active route layer whose markup has been initialized into a view.
 */
interface ActiveLayer {
  id: number;
  view: ViewElement;
}

/**
 * Object passed to redirect callbacks. Contains information useful for determining how to redirect.
 */
export interface RouteRedirectContext {
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
  params: Record<string, string | number | undefined>;

  /**
   * Query params parsed from `path`.
   */
  query: Record<string, string | number | boolean | undefined>;
}

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

export function createRouter(options: RouterOptions): Router {
  return new Router(options);
}

const ROUTER_MOUNT = Symbol.for("DollaRouterMountMethod");
const ROUTER_UNMOUNT = Symbol.for("DollaRouterUnmountMethod");

export function _isRouter(value: any): value is Router {
  return value?.[IS_ROUTER] === true;
}

export async function _mountRouter(router: Router, dolla: Dolla) {
  return router[ROUTER_MOUNT](dolla);
}

export async function _unmountRouter(router: Router) {
  return router[ROUTER_UNMOUNT]();
}

export class Router {
  [IS_ROUTER] = true;

  #dolla?: Dolla;
  #logger?: Logger;

  #layerId = 0;
  #activeLayers: ActiveLayer[] = [];
  #routes: ParsedRoute<RouteMeta>[] = [];

  #isMounted = false;

  /**
   * Use hash routing when true. Configured in router options.
   */
  #hash = false;

  // Callbacks that need to be called on unmount.
  #unsubscribers: UnsubscribeFunction[] = [];

  /**
   * The current match object.
   */
  #match = atom<RouteMatch>();

  /**
   * The currently matched route pattern, if any.
   */
  readonly pattern = compose(() => this.#match.get()?.pattern);

  /**
   * The current URL path.
   */
  readonly path = compose(() => this.#match.get()?.path ?? window.location.pathname);

  /**
   * The current named path params.
   */
  readonly params = compose(() => this.#match.get()?.params ?? {}, { equals: shallowEqual });

  /**
   * The current query params. Changes to this object will be reflected in the URL.
   */
  readonly query = compose(() => this.#match.get()?.query ?? {}, { equals: shallowEqual });

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

  async [ROUTER_MOUNT](dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("Dolla.router");

    // Listen for popstate events and update route accordingly.
    const onPopState = () => {
      this.#updateRoute(undefined, {});
    };
    window.addEventListener("popstate", onPopState);
    this.#unsubscribers.push(() => window.removeEventListener("popstate", onPopState));

    const rootElement = dolla.getRootElement()!;

    // Listen for clicks on <a> tags within the app.
    this.#unsubscribers.push(
      catchLinks(rootElement, (anchor) => {
        let href = anchor.getAttribute("href")!;
        this.#logger!.info("intercepted click on <a> tag", anchor);

        const preserve = anchor.getAttribute("data-router-preserve-query");

        this.go(href, {
          preserveQuery: parsePreserveQueryAttribute(preserve),
        });
      }),
    );
    this.#logger.info("will intercept clicks on <a> tags within root element", rootElement);

    this.#isMounted = true;

    // Setup initial route content.
    await this.#updateRoute(undefined, {});
  }

  async [ROUTER_UNMOUNT]() {
    for (const callback of this.#unsubscribers) {
      callback();
    }
    this.#unsubscribers = [];
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
  updateQuery(values: Record<string, string>) {
    const match = this.#match.get()!;
    const query = { ...this.query.get() };

    for (const key in values) {
      const value = values[key];
      if (value === null) {
        delete query[key];
      } else {
        query[key] = value;
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
    this.#logger?.info("(push)", href);

    window.history.pushState(null, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href, options);
  }

  #replace(href: string, options: NavigateOptions) {
    this.#logger?.info("(replace)", href);

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
  async #updateRoute(href: string | undefined, options: NavigateOptions) {
    const logger = this.#logger;
    const rootView = this.#dolla?.getRootView();
    const url = href ? new URL(href, window.location.origin) : this.#getCurrentURL();

    const { match, journey } = await this.#resolveRoute(url);

    for (const step of journey) {
      switch (step.kind) {
        case "match":
          logger?.info(`📍 ${step.message}`);
          break;
        case "redirect":
          logger?.info(`↩️ ${step.message}`);
          break;
        case "miss":
          logger?.info(`💀 ${step.message}`);
          break;
        default:
          break;
      }
    }

    if (match) {
      const oldPattern = this.pattern.peek();

      // Merge query params.
      let query = match.query;
      let queryParts: string[] = [];

      if (options.preserveQuery === true) {
        query = Object.assign({}, this.query.get(), match.query);
      } else if (isArray(options.preserveQuery)) {
        const preserved: Record<string, any> = {};
        const current = this.query.get();
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

      this.#match.set({ ...match, query });

      // Update the URL if matched path differs from navigator path.
      // This happens if route resolution involved redirects.
      if (rootView && (match.path !== location.pathname || location.search !== queryString)) {
        window.history.replaceState(null, "", this.#hash ? "/#" + match.path + queryString : match.path + queryString);
      }

      if (rootView && match.pattern !== oldPattern) {
        this.#mountRoute(rootView, match);
      }
    } else {
      // Only crash if routing has been configured.
      if (this.#isMounted) {
        logger!.crash(new NoRouteError(`Failed to match route '${url.pathname}'`));
      }
    }

    return { match, journey };
  }

  /**
   * Takes a matched route and mounts it.
   */
  #mountRoute(rootView: ViewElement, match: RouteMatch<RouteMeta>) {
    const layers = match.meta.layers!;

    // Diff and update route layers.
    for (let i = 0; i < layers.length; i++) {
      const matchedLayer = layers[i];
      const activeLayer = this.#activeLayers[i];

      if (activeLayer?.id !== matchedLayer.id) {
        // Discard all previously active layers starting at this depth.
        this.#activeLayers = this.#activeLayers.slice(0, i);
        activeLayer?.view.unmount();

        const parentLayer = this.#activeLayers.at(-1);
        const parent = parentLayer?.view ?? rootView;

        const view = parent.setRouteView(matchedLayer.view);
        this.#activeLayers.push({ id: matchedLayer.id, view });
      }
    }
  }

  /**
   * Takes a URL and finds a match, following redirects.
   */
  async #resolveRoute(
    url: URL,
    journey: JourneyStep[] = [],
  ): Promise<{
    match: RouteMatch<RouteMeta> | null;
    journey: JourneyStep[];
  }> {
    const match = matchRoutes(this.#routes, url.pathname);

    if (!match) {
      return {
        match: null,
        journey: [...journey, { kind: "miss", message: `no match for '${url.pathname}'` }],
      };
    }

    let redirect = match.meta.redirect;

    if (match.meta.beforeMatch) {
      await match.meta.beforeMatch({
        // TODO: Allow setting context variables from here? Would apply to the context of the matched view.
        redirect: (path) => {
          redirect = path;
        },
      });
    }

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
        };
        path = await redirect(redirectContext);
        if (!isString(path)) {
          throw new Error(`Redirect function must return a path to redirect to.`);
        }
        if (!path.startsWith("/")) {
          // Not absolute. Resolve against matched path.
          path = resolvePath(match.path, path);
        }
      } else {
        throw new TypeError(`Redirect must either be a path string or a function.`);
      }

      return this.#resolveRoute(new URL(path, window.location.origin), [
        ...journey,
        { kind: "redirect", message: `redirecting '${match.path}' -> '${path}'` },
      ]);
    } else {
      return { match, journey: [...journey, { kind: "match", message: `matched route '${match.path}'` }] };
    }
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

      routes.push({
        pattern: "/" + joinPath([...parts, ...splitPath(route.path)]),
        meta: {
          redirect,
        },
      });

      return routes;
    }

    let view: ViewFunction<any> = Passthrough;

    if (isFunction(route.view)) {
      view = route.view;
    } else if (route.view) {
      throw new TypeError(`Route '${route.path}' expected a view function or undefined. Got: ${route.view}`);
    }

    const layer: RouteLayer = { id: this.#layerId++, view };

    // Parse nested routes if they exist.
    if (route.routes) {
      for (const subroute of route.routes) {
        routes.push(...this.#prepareRoute(subroute, [...parents, route], [...layers, layer]));
      }
    } else {
      routes.push({
        pattern: parent ? joinPath([...parents.map((p) => p.path), route.path]) : route.path,
        meta: {
          pattern: route.path,
          layers: [...layers, layer],
          beforeMatch: route.beforeMatch,
        },
      });
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
