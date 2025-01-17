import { createBrowserHistory, createHashHistory, Update, type History } from "history";
import {
  joinPath,
  matchRoutes,
  ParsedRoute,
  parseQueryParams,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
} from "../routing.js";
import { createState, StopFunction, watch } from "../state.js";
import { isFunction, isString } from "../typeChecking.js";
import { type Stringable } from "../types.js";
import { ViewNode, type ViewFunction } from "../view.js";
import { Passthrough } from "../views/passthrough.js";
import type { Dolla, Logger } from "./dolla.js";

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
  node: ViewNode;
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

export enum RoutingStyle {
  /**
   * Constructs routes like "https://www.example.com/#/sub/route" which work without any server-side setup.
   * A good choice if your app has no backend.
   */
  hash = "hash",

  /**
   * Constructs routes like "https://www.example.com/sub/route" which look nicer (subjective?) than hash routes and are what most users will expect URLs to look like, but require additional backend setup.
   * Path routing requires you to configure your backend to redirect to the app's index.html when subpaths are requested.
   */
  path = "path",
}

export interface RouterSetupOptions {
  routes: Route[];

  /**
   * The routing style to use; "hash" will construct routes like "https://www.example.com/#/sub/route" which work without any server-side setup, while "path" will construct routes that use paths directly.
   */
  style?: RoutingStyle;
}

export interface RouterElements {
  readonly rootElement?: HTMLElement;
  readonly rootView?: ViewNode;
}

// ----- Code ----- //

export class Router {
  #dolla: Dolla;
  #logger: Logger;
  #elements: RouterElements;

  #history!: History;
  #layerId = 0;
  #activeLayers: ActiveLayer[] = [];
  #lastQuery?: string;
  #routes: ParsedRoute<RouteConfig["meta"]>[] = [];

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
    const [$params, setParams] = createState<ParsedParams>({});
    const [$query, setQuery] = createState<ParsedQuery>(
      parseQueryParams(typeof window === "undefined" ? "" : (window.location.search ?? "")),
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
      // If router setup has not run, we don't need to do anything.
      if (this.#history == null) return;

      // Update URL when query changes
      this.#cleanupCallbacks.push(
        watch([$query], (current) => {
          const params = new URLSearchParams();

          for (const key in current) {
            params.set(key, String(current[key]));
          }

          const search = "?" + params.toString();

          if (search != this.#history.location.search) {
            this.#history.replace({
              pathname: this.#history.location.pathname,
              search,
            });
          }
        }),
      );

      this.#cleanupCallbacks.push(this.#history.listen(this.#onRouteChange.bind(this)));
      this.#onRouteChange(this.#history);

      this.#cleanupCallbacks.push(
        catchLinks(this.#elements.rootElement!, (anchor) => {
          let href = anchor.getAttribute("href")!;

          this.#logger.info("Intercepted link click", anchor, href);

          if (!/^https?:\/\/|^\//.test(href)) {
            href = joinPath([this.#history.location.pathname, href]);
          }

          this.#history.push(href);
        }),
      );
      this.#logger.info("Intercepting <a> clicks within root element:", this.#elements.rootElement!);
    });

    dolla.onUnmount(() => {
      while (this.#cleanupCallbacks.length > 0) {
        const callback = this.#cleanupCallbacks.pop()!;
        callback();
      }
    });
  }

  setup(options: RouterSetupOptions) {
    if (this.#dolla.isMounted) {
      this.#logger.crash(
        new Error(`Dolla is already mounted. Router setup must be called before Dolla.mount is called.`),
      );
      return;
    }

    if (options.style === RoutingStyle.hash) {
      this.#history = createHashHistory();
    } else {
      this.#history = createBrowserHistory();
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
   * Navigates to another route.
   *
   * @example
   * navigate("/login"); // navigate to `/login`
   * navigate(["/users", 215], { replace: true }); // replace current history entry with `/users/215`
   */
  go(path: Stringable | Stringable[], options: NavigateOptions = {}) {
    if (this.#history == null) {
      this.#logger.crash(
        new Error(
          `Router.go was called, but the router was never configured! Run 'Dolla.router.setup' before 'Dolla.mount' to configure routes.`,
        ),
      );
      return;
    }

    let joined: string;

    if (Array.isArray(path)) {
      joined = joinPath(path);
    } else {
      joined = path.toString();
    }

    joined = resolvePath(this.#history.location.pathname, joined);

    if (options.preserveQuery) {
      joined += this.#history.location.search;
    }

    if (options.replace) {
      this.#history.replace(joined);
    } else {
      this.#history.push(joined);
    }
  }

  /**
   * Navigate backward. Pass a number of steps to hit the back button that many times.
   */
  back(steps = 1) {
    if (this.#history == null) {
      this.#logger.crash(
        new Error(
          `Router.back was called, but the router was never configured! Run 'Dolla.router.setup' before 'Dolla.mount' to configure routes.`,
        ),
      );
      return;
    }

    this.#history.go(-steps);
  }

  /**
   * Navigate forward. Pass a number of steps to hit the forward button that many times.
   */
  forward(steps = 1) {
    if (this.#history == null) {
      this.#logger.crash(
        new Error(
          `Router.forward was called, but the router was never configured! Run 'Dolla.router.setup' before 'Dolla.mount' to configure routes.`,
        ),
      );
      return;
    }

    this.#history.go(steps);
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

  /**
   * Run when the location changes. Diffs and mounts new routes and updates
   * the $path, $route, $params and $query states accordingly.
   */
  async #onRouteChange({ location }: History | Update) {
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

    if (matched.meta.beforeMatch) {
      await matched.meta.beforeMatch({
        redirect: (path) => {
          // TODO: Implement
          throw new Error(`Redirect not yet implemented.`);
        },
      });
    }

    this.#logger.info(`Matched route: '${matched.pattern}' ('${matched.path}')`);

    if (matched.meta.redirect != null) {
      if (typeof matched.meta.redirect === "string") {
        const path = replaceParams(matched.meta.redirect, matched.params);
        this.#logger.info(`Redirecting to: '${path}'`);
        this.#history.replace(path);
      } else if (typeof matched.meta.redirect === "function") {
        const redirectContext: RouteRedirectContext = {
          path: matched.path,
          pattern: matched.pattern,
          params: matched.params,
          query: matched.query,
        };
        let path = await matched.meta.redirect(redirectContext);
        if (typeof path !== "string") {
          throw new Error(`Redirect function must return a path to redirect to.`);
        }
        if (!path.startsWith("/")) {
          // Not absolute. Resolve against matched path.
          path = resolvePath(matched.path, path);
        }
        this.#logger.info(`Redirecting to: '${path}'`);
        this.#history.replace(path);
      } else {
        throw new TypeError(`Redirect must either be a path string or a function.`);
      }
    } else {
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
            this.#logger.info(`Replacing layer @${i} (active ID: ${activeLayer?.id}, matched ID: ${matchedLayer.id})`);

            // Remove any previously active layers at this depth or deeper.
            this.#activeLayers = this.#activeLayers.slice(0, i);

            const parentLayer = this.#activeLayers.at(-1);
            const node = this.#dolla.constructView(matchedLayer.view, {});

            if (activeLayer && activeLayer.node.isMounted) {
              // Disconnect first mismatched active layer.
              activeLayer.node.unmount();
            }

            // Replace parentLayer's previous children with the new layer.
            if (parentLayer) {
              parentLayer.node.setChildren([node]);
            } else {
              this.#elements.rootView!.setChildren([node]);
            }

            // Store the new active layer.
            this.#activeLayers.push({ id: matchedLayer.id, node });
          }
        }
      }
    }
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
