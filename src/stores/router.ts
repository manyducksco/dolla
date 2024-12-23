import { createBrowserHistory, createHashHistory, type History, type Listener } from "history";
import { ElementContext } from "../app.js";
import { getRenderHandle, m, renderMarkupToDOM, type DOMHandle, type Markup } from "../markup.js";
import {
  joinPath,
  matchRoutes,
  parseQueryParams,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
} from "../routing.js";
import { signal } from "../signals.js";
import { getStoreSecrets, type Store, type StoreContext } from "../store.js";
import { isFunction, isString } from "../typeChecking.js";
import { type BuiltInStores, type Stringable } from "../types.js";
import { type View } from "../view.js";
import { DefaultView } from "../views/default-view.js";

// ----- Types ----- //

export interface RouteMatchContext {
  /**
   * Returns the shared instance of `store`.
   */
  getStore<T extends Store<any, any>>(store: T): ReturnType<T>;

  /**
   * Returns the shared instance of a built-in store.
   */
  getStore<N extends keyof BuiltInStores>(name: N): BuiltInStores[N];

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
  markup: Markup;
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
 * An active route layer whose markup has been initialized into a view.
 */
interface ActiveLayer {
  id: number;
  handle: DOMHandle;
}

interface ParsedParams {
  [key: string]: string | number | boolean | (string | number | boolean | null)[] | null;
}

interface ParsedQuery extends ParsedParams {}

interface NavigateOptions {
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

interface RouterStoreOptions {
  routes: Route[];

  /**
   * Use hash-based routing if true.
   */
  hash?: boolean;

  /**
   * A history object from the `history` package.
   *
   * @see https://www.npmjs.com/package/history
   */
  history?: History;
}

// ----- Code ----- //

export function RouterStore(ctx: StoreContext<RouterStoreOptions>) {
  ctx.name = "dolla/router";

  const { appContext, elementContext } = getStoreSecrets(ctx);
  const render = ctx.getStore("render");

  let history: History;

  if (ctx.options.history) {
    history = ctx.options.history;
  } else if (ctx.options.hash) {
    history = createHashHistory();
  } else {
    history = createBrowserHistory();
  }

  let layerId = 0;

  /**
   * Parses a route definition object into a set of matchable routes.
   *
   * @param route - Route config object.
   * @param layers - Array of parent layers. Passed when this function calls itself on nested routes.
   */
  function prepareRoute(route: Route, parents: Route[] = [], layers: RouteLayer[] = []) {
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

    let view: View<any> = DefaultView;

    if (typeof route.view === "function") {
      view = route.view;
    } else if (route.view) {
      throw new TypeError(`Route '${route.path}' expected a view function or undefined. Got: ${route.view}`);
    }

    const markup = m(view);
    const layer: RouteLayer = { id: layerId++, markup };

    // Parse nested routes if they exist.
    if (route.routes) {
      for (const subroute of route.routes) {
        routes.push(...prepareRoute(subroute, [...parents, route], [...layers, layer]));
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

  const routes = sortRoutes(
    ctx.options.routes
      .flatMap((route) => prepareRoute(route))
      .map((route) => ({
        pattern: route.pattern,
        meta: route.meta,
        fragments: patternToFragments(route.pattern),
      })),
  );

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

  ctx.onConnected(() => {
    ctx.info("Routes registered:", routes);
  });

  const [$pattern, setPattern] = signal<string | null>(null);
  const [$path, setPath] = signal("");
  const [$params, setParams] = signal<ParsedParams>({});
  const [$query, setQuery] = signal<ParsedQuery>(parseQueryParams(window.location.search));

  // Update URL when query changes
  ctx.watch([$query], (current) => {
    const params = new URLSearchParams();

    for (const key in current) {
      params.set(key, String(current[key]));
    }

    const search = "?" + params.toString();

    if (search != history.location.search) {
      history.replace({
        pathname: history.location.pathname,
        search,
      });
    }
  });

  ctx.onConnected(() => {
    history.listen(onRouteChange);
    onRouteChange(history);

    ctx.info("Intercepting <a> clicks within root element:", appContext.rootElement);
    catchLinks(appContext.rootElement!, (anchor) => {
      let href = anchor.getAttribute("href")!;

      ctx.info("Intercepted link click", anchor, href);

      if (!/^https?:\/\/|^\//.test(href)) {
        href = joinPath([history.location.pathname, href]);
      }

      history.push(href);
    });
  });

  let activeLayers: ActiveLayer[] = [];
  let lastQuery: string;

  /**
   * Run when the location changes. Diffs and mounts new routes and updates
   * the $path, $route, $params and $query states accordingly.
   */
  const onRouteChange: Listener = async ({ location }) => {
    // Update query params if they've changed.
    if (location.search !== lastQuery) {
      lastQuery = location.search;

      setQuery(parseQueryParams(location.search));
    }

    const matched = matchRoutes(routes, location.pathname);

    if (!matched) {
      setPattern(null);
      setPath(location.pathname);
      setParams({
        wildcard: location.pathname,
      });
      return;
    }

    if (matched.meta.beforeMatch) {
      await matched.meta.beforeMatch({
        getStore(store: keyof BuiltInStores | Store<any, any>) {
          let name: string;

          if (typeof store === "string") {
            name = store as keyof BuiltInStores;
          } else {
            name = store.name;
          }

          if (typeof store !== "string") {
            let ec: ElementContext | undefined = elementContext;
            while (ec) {
              if (ec.stores.has(store)) {
                return ec.stores.get(store)?.instance!.exports;
              }
              ec = ec.parent;
            }
          }

          if (appContext.stores.has(store)) {
            const _store = appContext.stores.get(store)!;

            if (!_store.instance) {
              appContext.crashCollector.crash({
                componentName: ctx.name,
                error: new Error(`Store '${name}' is not registered on this app.`),
              });
            }

            return _store.instance!.exports;
          }

          appContext.crashCollector.crash({
            componentName: ctx.name,
            error: new Error(`Store '${name}' is not registered on this app.`),
          });
        },
        redirect: (path) => {
          // TODO: Implement
          throw new Error(`Redirect not yet implemented.`);
        },
      });
    }

    ctx.info(`Matched route: '${matched.pattern}' ('${matched.path}')`);

    if (matched.meta.redirect != null) {
      if (typeof matched.meta.redirect === "string") {
        const path = replaceParams(matched.meta.redirect, matched.params);
        ctx.info(`Redirecting to: '${path}'`);
        history.replace(path);
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
        ctx.info(`Redirecting to: '${path}'`);
        history.replace(path);
      } else {
        throw new TypeError(`Redirect must either be a path string or a function.`);
      }
    } else {
      setPath(matched.path);
      setParams(matched.params);

      if (matched.pattern !== $pattern.get()) {
        setPattern(matched.pattern);

        const layers = matched.meta.layers!;

        // Diff and update route layers.
        for (let i = 0; i < layers.length; i++) {
          const matchedLayer = layers[i];
          const activeLayer = activeLayers[i];

          if (activeLayer?.id !== matchedLayer.id) {
            ctx.info(`Replacing layer @${i} (active ID: ${activeLayer?.id}, matched ID: ${matchedLayer.id})`);

            activeLayers = activeLayers.slice(0, i);

            const parentLayer = activeLayers[activeLayers.length - 1];
            const renderContext = { appContext, elementContext };

            const rendered = renderMarkupToDOM(matchedLayer.markup, renderContext);
            const handle = getRenderHandle(rendered);

            if (activeLayer && activeLayer.handle.connected) {
              // Disconnect first mismatched active layer.
              activeLayer.handle.disconnect();
            }

            if (parentLayer) {
              parentLayer.handle.setChildren(rendered);
            } else {
              appContext.rootView!.setChildren(rendered);
            }

            // Push and connect new active layer.
            activeLayers.push({ id: matchedLayer.id, handle });
          }
        }
      }
    }
  };

  function navigate(path: Stringable, options?: NavigateOptions): void;
  function navigate(fragments: Stringable[], options?: NavigateOptions): void;

  function navigate(path: Stringable | Stringable[], options: NavigateOptions = {}) {
    let joined: string;

    if (Array.isArray(path)) {
      joined = joinPath(path);
    } else {
      joined = path.toString();
    }

    joined = resolvePath(history.location.pathname, joined);

    if (options.preserveQuery) {
      joined += history.location.search;
    }

    if (options.replace) {
      history.replace(joined);
    } else {
      history.push(joined);
    }
  }

  return {
    /**
     * The currently matched route pattern, if any.
     */
    $pattern,

    /**
     * The current URL path.
     */
    $path,

    /**
     * The current named path params.
     */
    $params,

    /**
     * The current query params. Changes to this object will be reflected in the URL.
     */
    $query,
    setQuery,

    /**
     * Navigate backward. Pass a number of steps to hit the back button that many times.
     */
    back(steps = 1) {
      history.go(-steps);
    },

    /**
     * Navigate forward. Pass a number of steps to hit the forward button that many times.
     */
    forward(steps = 1) {
      history.go(steps);
    },

    /**
     * Navigates to another route.
     *
     * @example
     * navigate("/login"); // navigate to `/login`
     * navigate(["/users", 215], { replace: true }); // replace current history entry with `/users/215`
     *
     * @param args - One or more path segments optionally followed by an options object.
     */
    navigate,

    /**
     * Updates a query param in place.
     */
    // updateQuery(key: string, value: string) {},

    /**
     * Updates a route param in place.
     */
    // updateParam(key: string, value: string) {},
  };
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
