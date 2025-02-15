import type { Dolla, Logger } from "../core/dolla.js";
import { type ViewElement, type ViewFunction } from "../core/nodes/view.js";
import { atom, compose } from "../core/reactive.js";
import { createState, derive, type StopFunction } from "../core/state.js";
import { IS_ROUTER } from "../core/symbols.js";
import { assertObject, isFunction, isObject, isString } from "../typeChecking.js";
import type { Stringable } from "../types.js";
import { shallowEqual } from "../utils.js";
import { Passthrough } from "../views/passthrough.js";
import {
  joinPath,
  matchRoutes,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
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
   */
  preserveQuery?: boolean;
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
  #cleanupCallbacks: StopFunction[] = [];

  /**
   * The current match object.
   */
  #match = atom<RouteMatch>();

  /**
   * The currently matched route pattern, if any.
   */
  readonly pattern = compose((get) => get(this.#match)?.pattern);

  /**
   * The current URL path.
   */
  readonly path = compose((get) => get(this.#match)?.path ?? window.location.pathname);

  /**
   * The current named path params.
   */
  readonly params = compose((get) => get(this.#match)?.params ?? {}, { equals: shallowEqual });

  /**
   * The current query params. Changes to this object will be reflected in the URL.
   */
  readonly query = compose((get) => get(this.#match)?.query ?? {}, { equals: shallowEqual });

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
      this.#updateRoute();
    };
    window.addEventListener("popstate", onPopState);
    this.#cleanupCallbacks.push(() => window.removeEventListener("popstate", onPopState));

    const rootElement = dolla.getRootElement()!;

    // Listen for clicks on <a> tags within the app.
    this.#cleanupCallbacks.push(
      catchLinks(rootElement, (anchor) => {
        let href = anchor.getAttribute("href")!;
        this.#logger!.info("intercepted click on <a> tag", anchor);

        if (!/^https?:\/\/|^\//.test(href)) {
          href = joinPath([window.location.pathname, href]);
        }

        this.#push(href);
      }),
    );
    this.#logger.info("will intercept clicks on <a> tags within root element", rootElement);

    this.#isMounted = true;

    // Setup initial route content.
    await this.#updateRoute();
  }

  async [ROUTER_UNMOUNT]() {
    for (const callback of this.#cleanupCallbacks) {
      callback();
    }
    this.#cleanupCallbacks = [];
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
    if (this.#dolla == null) {
      throw new Error(`Routa methods won't work until you register it: Dolla.use(Routa, { /* ...options */ })`);
    }

    let joined: string;

    if (Array.isArray(path)) {
      joined = joinPath(path);
    } else {
      joined = path.toString();
    }

    joined = resolvePath(window.location.pathname, joined);

    if (options.preserveQuery) {
      joined += window.location.search;
    }

    if (options.replace) {
      this.#replace(joined);
    } else {
      this.#push(joined);
    }
  }

  #push(href: string, state?: any) {
    this.#logger?.info("(push)", href);

    window.history.pushState(state, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href);
  }

  #replace(href: string, state?: any) {
    this.#logger?.info("(replace)", href);

    window.history.replaceState(state, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href);
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
  async #updateRoute(href?: string) {
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
      this.#match.value = match;

      if (rootView && match.pattern !== this.pattern.value) {
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

        const view = parent.setChildView(matchedLayer.view);
        this.#activeLayers.push({ id: matchedLayer.id, view });
      }
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

const safeExternalLink = /(noopener|noreferrer) (noopener|noreferrer)/;
const protocolLink = /^[\w-_]+:/;

/**
 * Intercepts links within the root node.
 *
 * This is adapted from https://github.com/choojs/nanohref/blob/master/index.js
 *
 * @param root - Element under which to intercept link clicks
 * @param callback - Function to call when a click event is intercepted
 * @param _window - (optional) Override for global window object
 */
export function catchLinks(root: Element, callback: (anchor: HTMLAnchorElement) => void, _window = window) {
  function traverse(node: HTMLElement | null): HTMLAnchorElement | null {
    if (!node || node === root) {
      return null;
    }

    if (node.localName !== "a" || (node as any).href === undefined) {
      return traverse(node.parentNode as HTMLElement | null);
    }

    return node as HTMLAnchorElement;
  }

  function handler(e: MouseEvent) {
    if ((e.button && e.button !== 0) || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) {
      return;
    }

    const anchor = traverse(e.target as HTMLElement);

    if (!anchor) {
      return;
    }

    if (
      _window.location.protocol !== anchor.protocol ||
      _window.location.hostname !== anchor.hostname ||
      _window.location.port !== anchor.port ||
      anchor.hasAttribute("data-router-ignore") ||
      anchor.hasAttribute("download") ||
      (anchor.getAttribute("target") === "_blank" && safeExternalLink.test(anchor.getAttribute("rel")!)) ||
      protocolLink.test(anchor.getAttribute("href")!)
    ) {
      return;
    }

    e.preventDefault();
    callback(anchor);
  }

  root.addEventListener("click", handler as any);

  return function cancel() {
    root.removeEventListener("click", handler as any);
  };
}

/**
 * Replace route pattern param placeholders with real matched values.
 */
function replaceParams(path: string, params: Record<string, string | number>) {
  for (const key in params) {
    const value = params[key].toString();
    path = path.replace(`{${key}}`, value).replace(`{#${key}}`, value);
  }

  return path;
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
