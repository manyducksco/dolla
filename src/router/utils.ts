import { isFunction, isObject, isString } from "../typeChecking.js";
import { View } from "../types.js";
import { uniqueId } from "../utils.js";
import type { JourneyStep, LazyView, Route, RouteLayer, Stringable } from "./types.js";

export interface Match {
  /**
   * The path string that triggered this match.
   */
  path: string;

  /**
   * The pattern satisfied by `path`.
   */
  pattern: string;

  /**
   * Named params as parsed from `path`.
   */
  params: Record<string, string>;

  /**
   * Query params as parsed from `path`.
   */
  query: Record<string, string>;

  /**
   * Freeform data you wish to store with this route.
   * Merged `data` from all matched layers are available on the router's `match.meta`.
   */
  meta: Record<any, any>;
}

export interface RouteMatch extends Match {
  layers: RouteLayer[];
  redirect?: string | ((match: Match) => string) | ((match: Match) => Promise<string>);
}

export type RoutePayload = {
  pattern: string;
  meta: Record<any, any>;
  layers?: RouteLayer[];
  redirect?: string | ((match: Match) => string) | ((match: Match) => Promise<string>);
};

export type RouteMatchOptions = {
  willMatch?: (route: RoutePayload) => boolean;
};

/**
 * Separates a URL path into multiple fragments.
 *
 * @param path - A path string (e.g. `"/api/users/5"`)
 * @returns an array of fragments (e.g. `["api", "users", "5"]`)
 */
export function splitPath(path: string): string[] {
  return path
    .split("/")
    .map((f) => f.trim())
    .filter((f) => f !== "");
}

/**
 * Joins multiple URL path fragments into a single string.
 *
 * @param parts - One or more URL fragments (e.g. `["api", "users", 5]`)
 * @returns a joined path (e.g. `"api/users/5"`)
 */
export function joinPath(parts: { toString(): string }[]): string {
  parts = parts.filter((x) => x).flatMap(String);

  let joined = parts.shift()?.toString();

  if (joined) {
    for (const part of parts.map((p) => p.toString())) {
      if (part.startsWith(".")) {
        // Resolve relative path against joined
        joined = resolvePath(joined, part);
      } else if (joined[joined.length - 1] !== "/") {
        if (part[0] !== "/") {
          joined += "/" + part;
        } else {
          joined += part;
        }
      } else {
        if (part[0] === "/") {
          joined += part.slice(1);
        } else {
          joined += part;
        }
      }
    }

    // Remove trailing slash (unless path is just '/')
    if (joined && joined !== "/" && joined.endsWith("/")) {
      joined = joined.slice(0, joined.length - 1);
    }
  }

  return joined ?? "";
}

export function resolvePath(base: string, part: string | null) {
  if (part == null) {
    part = base;
    base = "";
  }

  if (part.startsWith("/")) {
    return part;
  }

  let resolved = base;

  while (true) {
    if (part.startsWith("..")) {
      for (let i = resolved.length; i > 0; --i) {
        if (resolved[i] === "/" || i === 0) {
          resolved = resolved.slice(0, i);
          part = part.replace(/^\.\.\/?/, "");
          break;
        }
      }
    } else if (part.startsWith(".")) {
      part = part.replace(/^\.\/?/, "");
    } else {
      break;
    }
  }

  return joinPath([resolved, part]);
}

export function parseQueryParams(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

export function mergeQueryParams(
  previous: Record<string, string>,
  current: Record<string, Stringable>,
  preserve?: boolean | string[],
) {
  const merged: Record<string, string> = {};
  const params = new URLSearchParams();

  if (preserve === true) {
    Object.assign(merged, previous, current);
  } else if (Array.isArray(preserve)) {
    const preserved: Record<string, any> = {};
    for (const key in previous) {
      if (preserve.includes(key)) {
        preserved[key] = current[key];
      }
    }
    Object.assign(merged, preserved, current);
  }

  for (const key in merged) {
    params.set(key, String(merged[key]));
  }

  return params;
}

export class RouteNode {
  staticChildren = new Map<string, RouteNode>();
  numericChild: RouteNode | null = null;
  paramChild: RouteNode | null = null;
  wildcardChild: RouteNode | null = null;

  // Set if this node represents the end of a valid path
  route?: RoutePayload;
  paramName?: string;
  numericName?: string;
}

export function buildRouteTree(routes: Route[]): RouteNode {
  const root = new RouteNode();

  const redirectsToValidate: RoutePayload[] = [];

  function insertIntoTree(pattern: string, payload: RoutePayload) {
    const parts = splitPath(pattern);
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];

      if (part === "*") {
        if (!current.wildcardChild) current.wildcardChild = new RouteNode();
        current = current.wildcardChild;
      } else if (part.charCodeAt(0) === 123) {
        // {
        if (part.charCodeAt(1) === 35) {
          // #
          if (!current.numericChild) current.numericChild = new RouteNode();
          current.numericChild.numericName = part.slice(2, -1);
          current = current.numericChild;
        } else {
          if (!current.paramChild) current.paramChild = new RouteNode();
          current.paramChild.paramName = part.slice(1, -1);
          current = current.paramChild;
        }
      } else {
        const key = part.toLowerCase();
        let next = current.staticChildren.get(key);
        if (!next) {
          next = new RouteNode();
          current.staticChildren.set(key, next);
        }
        current = next;
      }
    }

    current.route = payload;
  }

  function parse(route: Route, parents: Route[] = [], layers: RouteLayer[] = []) {
    if (!isObject<Route>(route) || !isString(route.path)) {
      throw new TypeError(`Routes must be objects with a 'path' string property. Got: ${route}`);
    }

    if (route.redirect && route.routes) {
      throw new Error(`Route cannot have both a 'redirect' and nested 'routes'.`);
    } else if (route.redirect && route.view) {
      throw new Error(`Route cannot have both a 'redirect' and a 'view'.`);
    } else if (!route.view && !route.routes && !route.redirect) {
      throw new Error(`Route must have a 'view', a 'redirect', or a set of nested 'routes'.`);
    }

    const parentPaths = parents.map((p) => p.path);
    const pattern = parentPaths.length ? joinPath([...parentPaths, route.path]) : route.path;

    // Merge meta
    let meta: Record<any, any> = {};
    if (route.meta) {
      const parent = parents.at(-1);
      meta = parent ? { ...parent.meta, ...route.meta } : route.meta;
    }

    // Handle Redirects
    if (route.redirect) {
      let redirect = route.redirect;

      if (isString(redirect)) {
        redirect = resolvePath(joinPath(parentPaths), redirect);
        if (!redirect.startsWith("/")) redirect = "/" + redirect;
      }

      const payload: RoutePayload = { pattern, meta, redirect };
      insertIntoTree(pattern, payload);

      if (isString(redirect)) redirectsToValidate.push(payload);
      return;
    }

    // Handle Views/Layers
    let view: View<any> = (props: any) => props.children;
    if (isFunction(route.view)) {
      view = route.view;
    } else if (route.view && !(route.view as LazyView)._lazy) {
      throw new TypeError(`Route '${route.path}' expected a view function. Got: ${route.view}`);
    }

    const layer: RouteLayer = {
      id: uniqueId(),
      pattern,
      view,
      preload: route.preload,
      errorView: route.errorView,
    };

    if (route.routes) {
      for (const subroute of route.routes) {
        parse(subroute, [...parents, route], [...layers, layer]);
      }
    } else {
      insertIntoTree(pattern, { pattern, meta, layers: [...layers, layer] });
    }
  }

  for (const route of routes) {
    parse(route);
  }

  // Validate string redirects against the tree
  for (const payload of redirectsToValidate) {
    const match = matchRoute(root, payload.redirect as string, {
      willMatch(r) {
        return r !== payload;
      },
    });
    if (!match) {
      throw new Error(`Found a redirect to an undefined URL. From '${payload.pattern}' to '${payload.redirect}'`);
    }
  }

  return root;
}

export function matchRoute(rootNode: RouteNode, url: string, options: RouteMatchOptions = {}): RouteMatch | undefined {
  const [path, query] = url.split("?");
  const parts = splitPath(path);

  function search(node: RouteNode, index: number, currentParams: Record<string, string>): RouteMatch | undefined {
    // if we've consumed all URL parts
    if (index === parts.length) {
      if (node.route && (!options.willMatch || options.willMatch(node.route))) {
        return {
          path: path || "/",
          pattern: node.route.pattern,
          params: currentParams,
          query: Object.fromEntries(new URLSearchParams(query || "")),
          meta: node.route.meta,
          layers: node.route.layers ?? [],
          redirect: node.route.redirect,
        };
      }
      return undefined;
    }

    const part = parts[index];
    const lowerPart = part.toLowerCase();

    // #1 check literal match
    const staticNode = node.staticChildren.get(lowerPart);
    if (staticNode) {
      const result = search(staticNode, index + 1, currentParams);
      if (result) return result;
    }

    // #2 check numeric match
    if (node.numericChild && !isNaN(Number(part))) {
      const result = search(node.numericChild, index + 1, {
        ...currentParams,
        [node.numericChild.numericName!]: part,
      });
      if (result) return result;
    }

    // #3 check param match
    if (node.paramChild) {
      const result = search(node.paramChild, index + 1, {
        ...currentParams,
        [node.paramChild.paramName!]: decodeURIComponent(part),
      });
      if (result) return result;
    }

    // #4 check wildcard match
    if (node.wildcardChild && node.wildcardChild.route) {
      if (!options.willMatch || options.willMatch(node.wildcardChild.route)) {
        return {
          path: path || "/",
          pattern: node.wildcardChild.route.pattern,
          params: {
            ...currentParams,
            wildcard: "/" + parts.slice(index).map(decodeURIComponent).join("/"),
          },
          query: Object.fromEntries(new URLSearchParams(query || "")),
          meta: node.wildcardChild.route.meta,
          layers: node.wildcardChild.route.layers ?? [],
          redirect: node.wildcardChild.route.redirect,
        };
      }
    }

    return undefined;
  }

  return search(rootNode, 0, {});
}

export interface ResolvedRoute {
  match?: RouteMatch;
  journey: JourneyStep[];
}

/**
 * Takes a URL and finds a match, following redirects.
 */
export async function resolveRoute(
  rootNode: RouteNode,
  path: string,
  journey: JourneyStep[] = [],
): Promise<ResolvedRoute> {
  const match = matchRoute(rootNode, path);

  if (!match) {
    return {
      journey: [...journey, { kind: "miss", message: `no match for '${path}'` }],
    };
  }

  let redirect = match.redirect;

  if (redirect != null) {
    let path: string;

    if (isString(redirect)) {
      path = replaceParams(redirect, match.params);
    } else if (typeof redirect === "function") {
      path = await redirect(match);

      if (!isString(path)) {
        throw new Error(`Redirect function must return a path to redirect to.`);
      }
      if (!path.startsWith("/")) {
        path = resolvePath(match.path, path);
      }
    } else {
      throw new TypeError(`Redirect must either be a path string or a function.`);
    }

    return resolveRoute(rootNode, path, [
      ...journey,
      { kind: "redirect", message: `redirecting '${match.path}' -> '${path}'` },
    ]);
  }

  // TODO: Data preload

  return { match, journey: [...journey, { kind: "match", message: `matched route '${match.path}'` }] };
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
export function catchLinks(
  root: Element,
  callback: (href: string, anchor: HTMLAnchorElement) => void,
  _window = window,
) {
  function handler(e: MouseEvent) {
    if ((e.button && e.button !== 0) || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.defaultPrevented) return;

    const anchor = (e.target as Element).closest("a");
    if (!anchor || !root.contains(anchor)) return;

    const href = anchor.getAttribute("href");
    if (!href) return;

    if (
      _window.location.protocol !== anchor.protocol ||
      _window.location.hostname !== anchor.hostname ||
      _window.location.port !== anchor.port ||
      anchor.hasAttribute("data-router-ignore") ||
      anchor.hasAttribute("download") ||
      (anchor.getAttribute("target") === "_blank" && safeExternalLink.test(anchor.getAttribute("rel")!)) ||
      protocolLink.test(href)
    ) {
      return;
    }

    e.preventDefault();
    callback(href, anchor);
  }

  root.addEventListener("click", handler as any);

  return function cancel() {
    root.removeEventListener("click", handler as any);
  };
}

/**
 * Replace route pattern param placeholders with real matched values.
 */
export function replaceParams(path: string, params: Record<string, string | number>) {
  for (const key in params) {
    const value = params[key].toString();
    path = path.replace(`{${key}}`, value).replace(`{#${key}}`, value);
  }

  return path;
}

// history.ts or utils.ts

export interface HistoryAdapter {
  getPath(): string;
  getSearch(): string;
  getKey(): string;
  push(url: string): void;
  replace(url: string): void;
}

export function createHistoryAdapter(useHash: boolean): HistoryAdapter {
  if (!window.history.state?.key) {
    window.history.replaceState({ ...window.history.state, key: Date.now().toString() }, "");
  }

  const getKey = () => window.history.state?.key || "root";

  if (useHash) {
    return {
      getPath: () => window.location.hash.slice(1).split("?")[0] || "/",
      getSearch: () => {
        const hash = window.location.hash;
        const searchIndex = hash.indexOf("?");
        return searchIndex !== -1 ? hash.slice(searchIndex) : "";
      },
      getKey,
      push: (url) => window.history.pushState({ key: uniqueId() }, "", "/#" + url),
      replace: (url) => window.history.replaceState({ key: getKey() }, "", "/#" + url),
    };
  }

  return {
    getPath: () => window.location.pathname,
    getSearch: () => window.location.search,
    getKey,
    push: (url) => window.history.pushState({ key: uniqueId() }, "", url),
    replace: (url) => window.history.replaceState({ key: getKey() }, "", url),
  };
}
