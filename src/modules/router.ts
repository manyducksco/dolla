import {
  joinPath,
  matchRoutes,
  type ParsedRoute,
  parseQueryParams,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
} from "./router.utils.js";
import { createState, type StopFunction } from "../core/state.js";
import { isFunction, isString } from "../typeChecking.js";
import { type Stringable } from "../types.js";
import { shallowEqual } from "../utils.js";
import { type ViewElement, type ViewFunction } from "../core/view.js";
import { Passthrough } from "../views/passthrough.js";
import type { Dolla, Logger } from "../core/dolla.js";

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

export interface RouteConfig {
  pattern: string;
  meta: {
    redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);
    pattern?: string;
    layers?: RouteLayer[];
    beforeMatch?: (ctx: RouteMatchContext) => void | Promise<void>;
  };
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
  node: ViewElement;
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

interface ParsedParams {
  [key: string]: string | number | boolean | (string | number | boolean | null)[] | null;
}

interface ParsedQuery extends ParsedParams {}

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

export interface RouterSetupOptions {
  routes: Route[];

  /**
   * When true, the router will construct routes like "https://www.example.com/#/sub/route" which work without any backend intervention.
   */
  hash?: boolean;
}

export interface RouterElements {
  readonly rootElement?: HTMLElement;
  readonly rootView?: ViewElement;
}

// ----- Code ----- //

export class Router {
  #dolla: Dolla;
  #logger: Logger;
  #elements: RouterElements;

  // #history!: History;
  #layerId = 0;
  #activeLayers: ActiveLayer[] = [];
  #lastQuery?: string;
  #routes: ParsedRoute<RouteConfig["meta"]>[] = [];

  /**
   * Use hash routing when true. Configured in router options.
   */
  #hash = false;

  // Callbacks that need to be called on unmount.
  #cleanupCallbacks: StopFunction[] = [];

  /**
   * The currently matched route pattern, if any.
   */
  $pattern;
  #setPattern;

  /**
   * The current URL path.
   */
  $path;
  #setPath;

  /**
   * The current named path params.
   */
  $params;
  #setParams;

  /**
   * The current query params. Changes to this object will be reflected in the URL.
   */
  $query;
  #setQuery;

  constructor(dolla: Dolla, elements: RouterElements) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("dolla/router");
    this.#elements = elements;

    const [$pattern, setPattern] = createState<string | null>(null);
    const [$path, setPath] = createState("");
    const [$params, setParams] = createState<ParsedParams>({}, { equals: shallowEqual });
    const [$query, setQuery] = createState<ParsedQuery>(
      parseQueryParams(typeof window === "undefined" ? "" : (window.location.search ?? "")),
      { equals: shallowEqual },
    );

    this.$pattern = $pattern;
    this.#setPattern = setPattern;

    this.$path = $path;
    this.#setPath = setPath;

    this.$params = $params;
    this.#setParams = setParams;

    this.$query = $query;
    this.#setQuery = setQuery;

    dolla.beforeMount(() => {
      // Listen for popstate events and update route accordingly.
      const onPopState = () => {
        this.#updateRoute();
      };
      window.addEventListener("popstate", onPopState);
      this.#cleanupCallbacks.push(() => window.removeEventListener("popstate", onPopState));

      // Listen for clicks on <a> tags within the app.
      this.#cleanupCallbacks.push(
        catchLinks(this.#elements.rootElement!, (anchor) => {
          let href = anchor.getAttribute("href")!;
          this.#logger.info("intercepted click on <a> tag", anchor);

          if (!/^https?:\/\/|^\//.test(href)) {
            href = joinPath([window.location.pathname, href]);
          }

          this.#push(href);
        }),
      );
      this.#logger.info("will intercept clicks on <a> tags within root element", this.#elements.rootElement!);

      // Setup initial route content.
      return this.#updateRoute();
    });

    dolla.onUnmount(() => {
      for (const callback of this.#cleanupCallbacks) {
        callback();
      }
      this.#cleanupCallbacks = [];
    });
  }

  setup(options: RouterSetupOptions) {
    if (this.#dolla.isMounted) {
      this.#logger.crash(
        new Error(`Dolla is already mounted. Dolla.router.setup() must be called before Dolla.mount().`),
      );
      return;
    }

    if (options.hash) {
      this.#hash = true;
    }

    this.#routes = sortRoutes(
      options.routes
        .flatMap((route) => this.#prepareRoute(route))
        .map((route) => ({
          pattern: route.pattern,
          meta: route.meta,
          fragments: patternToFragments(route.pattern),
        })),
    );

    // Test redirects to make sure all possible redirect targets actually exist.
    for (const route of this.#routes) {
      if (route.meta.redirect) {
        let redirectPath: string;

        if (isFunction(route.meta.redirect)) {
          // throw new Error(`Redirect functions are not yet supported.`);
          // Just allow, though it could fail later. Best not to call the function and cause potential side effects.
        } else if (isString(route.meta.redirect)) {
          redirectPath = route.meta.redirect;

          const match = matchRoutes(this.#routes, redirectPath, {
            willMatch(r) {
              return r !== route;
            },
          });

          if (!match) {
            throw new Error(
              `Found a redirect to an undefined URL. From '${route.pattern}' to '${route.meta.redirect}'`,
            );
          }
        } else {
          throw new TypeError(`Expected a string or redirect function. Got: ${route.meta.redirect}`);
        }
      }
    }
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
   * Dolla.router.go("/login"); // navigate to `/login`
   * Dolla.router.go["/users", 215], { replace: true }); // replace current history entry with `/users/215`
   */
  go(path: Stringable | Stringable[], options: NavigateOptions = {}) {
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

  #push(href: string) {
    this.#logger.info("(push)", href);

    window.history.pushState({}, "", this.#hash ? "/#" + href : href);
    this.#updateRoute(href);
  }

  #replace(href: string) {
    this.#logger.info("(replace)", href);

    window.history.replaceState({}, "", this.#hash ? "/#" + href : href);
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
    const location = href ? new URL(href, window.location.origin) : this.#getCurrentURL();

    this.#logger.info("updating route", { location, href });

    // Update query params if they've changed.
    if (location.search !== this.#lastQuery) {
      this.#lastQuery = location.search;
      this.#setQuery(parseQueryParams(location.search));
    }

    const matched = matchRoutes(this.#routes, location.pathname);

    if (!matched) {
      this.#setPattern(null);
      this.#setPath(location.pathname);
      this.#setParams({
        wildcard: location.pathname,
      });
      return;
    }

    let redirect = matched.meta.redirect;

    // TODO: Replace with concept of route middleware.
    if (matched.meta.beforeMatch) {
      await matched.meta.beforeMatch({
        // TODO: Allow setting context variables from here? Would apply to the context of the matched view.
        redirect: (path) => {
          redirect = path;
        },
      });
    }

    if (redirect != null) {
      if (typeof redirect === "string") {
        const path = replaceParams(redirect, matched.params);
        this.#logger.info(`↩️ redirecting from '${matched.path}' to '${path}'`);
        this.#replace(path);
      } else if (typeof redirect === "function") {
        const redirectContext: RouteRedirectContext = {
          path: matched.path,
          pattern: matched.pattern,
          params: matched.params,
          query: matched.query,
        };
        let path = await redirect(redirectContext);
        if (typeof path !== "string") {
          throw new Error(`Redirect function must return a path to redirect to.`);
        }
        if (!path.startsWith("/")) {
          // Not absolute. Resolve against matched path.
          path = resolvePath(matched.path, path);
        }
        this.#logger.info(`Redirecting to: '${path}'`);
        this.#replace(path);
      } else {
        throw new TypeError(`Redirect must either be a path string or a function.`);
      }
    } else {
      this.#logger.info(`📍 navigating to '${matched.path}'`);

      this.#setPath(matched.path);
      this.#setParams(matched.params);

      if (matched.pattern !== this.$pattern.get()) {
        this.#setPattern(matched.pattern);

        const layers = matched.meta.layers!;

        // Diff and update route layers.
        for (let i = 0; i < layers.length; i++) {
          const matchedLayer = layers[i];
          const activeLayer = this.#activeLayers[i];

          if (activeLayer?.id !== matchedLayer.id) {
            // Discard all previously active layers starting at this depth.
            this.#activeLayers = this.#activeLayers.slice(0, i);
            activeLayer?.node.unmount();

            const parentLayer = this.#activeLayers.at(-1);
            const parent = parentLayer?.node ?? this.#elements.rootView!;

            const node = parent.setChildView(matchedLayer.view);
            this.#activeLayers.push({ id: matchedLayer.id, node });
          }
        }
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
    if (!(typeof route === "object" && !Array.isArray(route)) || !(typeof route.path === "string")) {
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

    if (typeof route.view === "function") {
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
export function catchLinks(root: HTMLElement, callback: (anchor: HTMLAnchorElement) => void, _window = window) {
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

  root.addEventListener("click", handler);

  return function cancel() {
    root.removeEventListener("click", handler);
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
