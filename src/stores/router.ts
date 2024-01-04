import { isFunction, isString, joinPath, matchRoutes, parseQueryParams, resolvePath, type Route } from "@borf/bedrock";
import { createBrowserHistory, createHashHistory, type History, type Listener } from "history";
import { type Stringable } from "../types.js";
import { getRenderHandle, renderMarkupToDOM, type DOMHandle, type Markup } from "../markup.js";
import { readable, writable } from "../state.js";
import { getStoreSecrets, type StoreContext } from "../store.js";

// ----- Types ----- //

export interface RouterOptions {
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

export interface RouteConfig {
  pattern: string;
  meta: {
    redirect?: string | ((ctx: RedirectContext) => void);
    pattern?: string;
    layers?: RouteLayer[];
  };
}

export interface RouteLayer {
  id: number;
  markup: Markup;
}

/**
 * Properties passed to a redirect function.
 */
export interface RedirectContext {
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
   * The back button will send the user to the page they visited before this.
   */
  replace?: boolean;
}

interface RouterStoreOptions extends RouterOptions {
  /**
   * An instance of Router with the app's routes preloaded.
   */
  routes: Route<RouteConfig["meta"]>[];
}

// ----- Code ----- //

export function RouterStore(ctx: StoreContext<RouterStoreOptions>) {
  ctx.name = "dolla/router";

  const { appContext, elementContext } = getStoreSecrets(ctx);

  let history: History;

  if (ctx.options.history) {
    history = ctx.options.history;
  } else if (ctx.options.hash) {
    history = createHashHistory();
  } else {
    history = createBrowserHistory();
  }

  // Test redirects to make sure all possible redirect targets actually exist.
  for (const route of ctx.options.routes) {
    if (route.meta.redirect) {
      let redirectPath: string;

      if (isFunction(route.meta.redirect)) {
        throw new Error(`Redirect functions are not yet supported.`);
      } else if (isString(route.meta.redirect)) {
        redirectPath = route.meta.redirect;
      } else {
        throw new TypeError(`Expected a string or redirect function. Got: ${route.meta.redirect}`);
      }

      const match = matchRoutes(ctx.options.routes, redirectPath, {
        willMatch(r) {
          return r !== route;
        },
      });

      if (!match) {
        throw new Error(`Found a redirect to an undefined URL. From '${route.pattern}' to '${route.meta.redirect}'`);
      }
    }
  }

  const $$pattern = writable<string | null>(null);
  const $$path = writable("");
  const $$params = writable<ParsedParams>({});
  const $$query = writable<ParsedQuery>({});

  // Track and skip updating the URL when the change came from URL navigation
  let isRouteChange = false;

  // Update URL when query changes
  ctx.observe($$query, (current) => {
    // No-op if this is triggered by a route change.
    if (isRouteChange) {
      isRouteChange = false;
      return;
    }

    const params = new URLSearchParams();

    for (const key in current) {
      params.set(key, String(current[key]));
    }

    history.replace({
      pathname: history.location.pathname,
      search: "?" + params.toString(),
    });
  });

  ctx.onConnected(() => {
    history.listen(onRouteChange);
    onRouteChange(history);

    catchLinks(appContext.rootElement!, (anchor) => {
      let href = anchor.getAttribute("href")!;

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

      isRouteChange = true;
      $$query.set(parseQueryParams(location.search));
    }

    const matched = matchRoutes(ctx.options.routes, location.pathname);

    if (!matched) {
      $$pattern.set(null);
      $$path.set(location.pathname);
      $$params.set({
        wildcard: location.pathname,
      });
      return;
    }

    ctx.info(`Matched route: '${matched.pattern}'`);

    if (matched.meta.redirect != null) {
      if (typeof matched.meta.redirect === "string") {
        let path = matched.meta.redirect;

        for (const key in matched.params) {
          path = path.replace(":" + key, matched.params[key].toString());
        }

        // TODO: Update this code to work with new `{param}` style. Looks like it's still for `:params`

        ctx.info(`Redirecting to: '${path}'`);
        history.replace(path);
      } else if (typeof matched.meta.redirect === "function") {
        // TODO: Implement redirect by function.
        throw new Error(`Redirect functions aren't implemented yet.`);
      } else {
        throw new TypeError(`Redirect must either be a path string or a function.`);
      }
    } else {
      $$path.set(matched.path);
      $$params.set(matched.params);

      if (matched.pattern !== $$pattern.get()) {
        $$pattern.set(matched.pattern);

        const layers = matched.meta.layers!;

        // Diff and update route layers.
        for (let i = 0; i < layers.length; i++) {
          const matchedLayer = layers[i];
          const activeLayer = activeLayers[i];

          if (activeLayer?.id !== matchedLayer.id) {
            ctx.info(`Replacing layer ${i} (active ID: ${activeLayer?.id}, matched ID: ${matchedLayer.id})`);
            activeLayers = activeLayers.slice(0, i);

            const parentLayer = activeLayers[activeLayers.length - 1];
            const renderContext = { appContext, elementContext };

            const rendered = renderMarkupToDOM(matchedLayer.markup, renderContext);
            const handle = getRenderHandle(rendered);

            requestAnimationFrame(() => {
              if (activeLayer && activeLayer.handle.connected) {
                // Disconnect first mismatched active layer.
                activeLayer.handle.disconnect();
              }

              if (parentLayer) {
                parentLayer.handle.setChildren(rendered);
              } else {
                appContext.rootView!.setChildren(rendered);
              }
            });

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
    $pattern: readable($$pattern),

    /**
     * The current URL path.
     */
    $path: readable($$path),

    /**
     * The current named path params.
     */
    $params: readable($$params),

    /**
     * The current query params. Changes to this object will be reflected in the URL.
     */
    $$query,

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
