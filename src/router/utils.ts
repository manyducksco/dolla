import { View } from "../types.js";
import { assert, isArray, isFunction, isObject, isString, uniqueId } from "../utils.js";
import type { JourneyStep, Route, RouteLayer, Stringable } from "./types.js";

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

interface RouteMatch extends Match {
  layers: RouteLayer[];
  redirect?: string | ((match: Match) => string) | ((match: Match) => Promise<string>);
}

type RoutePayload = {
  pattern: string;
  meta: Record<any, any>;
  layers?: RouteLayer[];
  redirect?: string | ((match: Match) => string) | ((match: Match) => Promise<string>);
};

type RouteMatchOptions = {
  willMatch?: (route: RoutePayload) => boolean;
};

/**
 * Separates a URL path into multiple fragments.
 *
 * @param path - A path string (e.g. `"/api/users/5"`)
 * @returns an array of fragments (e.g. `["api", "users", "5"]`)
 */
function splitPath(path: string): string[] {
  const result: string[] = [];
  for (const segment of path.split("/")) {
    const trimmed = segment.trim();
    if (trimmed) result.push(trimmed);
  }
  return result;
}

/**
 * Joins multiple URL path fragments into a single string.
 *
 * @param parts - One or more URL fragments (e.g. `["api", "users", 5]`)
 * @returns a joined path (e.g. `"api/users/5"`)
 */

export function joinPath(parts: { toString(): string }[]): string {
  const joined = parts
    .map((p) => p.toString())
    .filter(Boolean)
    .join("/");
  if (!joined) return "";

  const isAbsolute = joined.startsWith("/");
  const segments = joined.split("/");
  const resolved: string[] = [];

  for (const segment of segments) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      // Pop the previous segment unless we're at the root, or already backing up
      if (resolved.length > 0 && resolved[resolved.length - 1] !== "..") {
        resolved.pop();
      } else if (!isAbsolute) {
        resolved.push("..");
      }
    } else {
      resolved.push(segment);
    }
  }

  let result = resolved.join("/");
  if (isAbsolute) result = "/" + result;

  return result || (isAbsolute ? "/" : "");
}

export function resolvePath(base: string, part: string | null = null): string {
  if (part == null) {
    part = base;
    base = "";
  }

  // If the target is absolute, it replaces the base entirely
  if (part.startsWith("/")) return joinPath([part]);

  // Otherwise, join them and let joinPath resolve the '.' and '..'
  return joinPath([base, part]);
}

function parseQueryParams(query: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(query));
}

export function mergeQueryParams(
  previous: Record<string, string>,
  current: Record<string, Stringable | null>,
  preserve?: boolean | string[],
) {
  const merged: Record<string, any> = {};

  if (preserve === true) {
    Object.assign(merged, previous);
  } else if (isArray(preserve)) {
    for (const key of preserve) {
      if (key in previous) merged[key] = previous[key];
    }
  }

  for (const [key, value] of Object.entries(current)) {
    if (value === null) {
      delete merged[key]; // Explicit nulls act as 'delete'
    } else {
      merged[key] = value;
    }
  }

  return new URLSearchParams(merged as Record<string, string>);
}

class RouteNode {
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

    for (const part of parts) {
      if (part === "*") {
        current = current.wildcardChild ??= new RouteNode();
      } else if (part.charCodeAt(0) === 123) {
        // {
        if (part.charCodeAt(1) === 35) {
          // #
          current = current.numericChild ??= new RouteNode();
          current.numericName = part.slice(2, -1);
        } else {
          current = current.paramChild ??= new RouteNode();
          current.paramName = part.slice(1, -1);
        }
      } else {
        const key = part.toLowerCase();
        let next = current.staticChildren.get(key);
        if (!next) current.staticChildren.set(key, (next = new RouteNode()));
        current = next;
      }
    }
    current.route = payload;
  }

  function parse(route: Route, parents: Route[] = [], layers: RouteLayer[] = []) {
    assert(isObject<Route>(route) && isString(route.path), "Invalid route object");

    const parentPaths = parents.map((p) => p.path);
    const parent = parents.at(-1);
    const meta = parent && route.meta ? { ...parent.meta, ...route.meta } : route.meta || {};

    const rawPattern = parentPaths.length ? joinPath([...parentPaths, route.path]) : route.path;
    const patterns = expandOptionalPaths(rawPattern);

    if (route.redirect) {
      assert(!route.routes && !route.view, "Route cannot mix redirect with view/routes");
      let redirect = route.redirect;

      if (isString(redirect)) {
        redirect = resolvePath(joinPath(parentPaths), redirect);
        if (!redirect.startsWith("/")) redirect = "/" + redirect;
      }

      for (const pattern of patterns) {
        const payload: RoutePayload = { pattern, meta, redirect };
        insertIntoTree(pattern, payload);
        if (isString(redirect)) redirectsToValidate.push(payload);
      }

      return;
    }

    assert(route.view || route.routes, "Route must have view, redirect, or routes");

    let view = (route.view || ((props: any) => props.children)) as View<any>;
    if (!isFunction(view) && !(view as any)._lazy) {
      throw new TypeError(`Expected view function for ${route.path}`);
    }

    if (route.routes) {
      // For parent nodes, create the layer using the raw pattern and recurse
      const layer: RouteLayer = {
        id: uniqueId(),
        pattern: rawPattern,
        view,
        preload: route.preload,
        errorView: route.errorView,
      };
      for (const subroute of route.routes) parse(subroute, [...parents, route], [...layers, layer]);
    } else {
      // For leaf nodes, register every permutation as a valid endpoint
      for (const pattern of patterns) {
        const layer: RouteLayer = {
          id: uniqueId(),
          pattern, // Use the specific expanded pattern for this layer
          view,
          preload: route.preload,
          errorView: route.errorView,
        };
        insertIntoTree(pattern, { pattern, meta, layers: [...layers, layer] });
      }
    }
  }

  for (const route of routes) parse(route);

  for (const payload of redirectsToValidate) {
    assert(
      matchRoute(root, payload.redirect as string, { willMatch: (r) => r !== payload }),
      `Dead redirect: ${payload.pattern} -> ${payload.redirect}`,
    );
  }

  return root;
}

export function matchRoute(rootNode: RouteNode, url: string, options: RouteMatchOptions = {}): RouteMatch | undefined {
  const [path, query] = url.split("?");
  const parts = splitPath(path);
  const paramState: Record<string, string> = {}; // Reused across branches

  function createMatch(route: RoutePayload, params: Record<string, string>): RouteMatch {
    return {
      path: path || "/",
      pattern: route.pattern,
      params,
      query: parseQueryParams(query || ""),
      meta: route.meta,
      layers: route.layers ?? [],
      redirect: route.redirect,
    };
  }

  function search(node: RouteNode, index: number): RouteMatch | undefined {
    // if we've consumed all URL parts
    if (index === parts.length) {
      if (node.route && (!options.willMatch || options.willMatch(node.route))) {
        return createMatch(node.route, { ...paramState });
      }

      // Allow wildcards to match zero remaining segments
      if (node.wildcardChild && node.wildcardChild.route) {
        if (!options.willMatch || options.willMatch(node.wildcardChild.route)) {
          return createMatch(node.wildcardChild.route, { ...paramState, wildcard: "/" });
        }
      }

      return undefined;
    }

    const part = parts[index];
    const lowerPart = part.toLowerCase();

    const staticNode = node.staticChildren.get(lowerPart);
    if (staticNode) {
      const result = search(staticNode, index + 1);
      if (result) return result;
    }

    if (node.numericChild && !isNaN(Number(part))) {
      paramState[node.numericChild.numericName!] = part;
      const result = search(node.numericChild, index + 1);
      if (result) return result;
      delete paramState[node.numericChild.numericName!];
    }

    if (node.paramChild) {
      paramState[node.paramChild.paramName!] = decodeURIComponent(part);
      const result = search(node.paramChild, index + 1);
      if (result) return result;
      delete paramState[node.paramChild.paramName!];
    }

    if (node.wildcardChild && node.wildcardChild.route) {
      if (!options.willMatch || options.willMatch(node.wildcardChild.route)) {
        return createMatch(node.wildcardChild.route, {
          ...paramState,
          wildcard: "/" + parts.slice(index).map(decodeURIComponent).join("/"),
        });
      }
    }

    return undefined;
  }

  return search(rootNode, 0);
}

interface ResolvedRoute {
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

  if (!match) return { journey: [...journey, { kind: "miss", message: `no match for '${path}'` }] };

  if (match.redirect != null) {
    let target = match.redirect;

    if (isString(target)) {
      target = replaceParams(target, match.params);
    } else {
      target = await target(match);
      assert(isString(target), "Redirect function must return a path.");
      if (!target.startsWith("/")) target = resolvePath(match.path, target);
    }

    return resolveRoute(rootNode, target, [
      ...journey,
      { kind: "redirect", message: `redirecting '${match.path}' -> '${target}'` },
    ]);
  }

  // TODO: Data preload

  return { match, journey: [...journey, { kind: "match", message: `matched route '${match.path}'` }] };
}

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
      anchor.getAttribute("target") === "_blank" ||
      /^[\w-_]+:/.test(href)
    ) {
      return;
    }

    e.preventDefault();
    callback(href, anchor);
  }

  root.addEventListener("click", handler as any);
  return () => root.removeEventListener("click", handler as any);
}

function expandOptionalPaths(path: string): string[] {
  const parts = splitPath(path);
  const permutations: string[][] = [[]];

  for (const part of parts) {
    // Strictly enforces the inside style: {param?} or {#param?}
    const isOptional = part.endsWith("?}");
    const cleanPart = isOptional ? part.replace("?", "") : part;

    if (isOptional) {
      const withPart = permutations.map((p) => [...p, cleanPart]);
      permutations.push(...withPart);
    } else {
      for (const p of permutations) {
        p.push(cleanPart);
      }
    }
  }

  return permutations.map((p) => "/" + p.join("/")).map((p) => (p === "/" ? p : p.replace(/\/$/, "")));
}

/**
 * Replace route pattern param placeholders with real matched values.
 */
export function replaceParams(path: string, params: Record<string, string | number>) {
  for (const key in params) {
    const value = String(params[key]);
    path = path
      .replace(`{${key}}`, value)
      .replace(`{#${key}}`, value)
      .replace(`{${key}?}`, value) // Handle optional string param
      .replace(`{#${key}?}`, value); // Handle optional numeric param
  }

  // Remove any remaining unmatched optional parameters
  path = path.replace(/\{#?[a-zA-Z0-9_]+\?\}/g, "");

  // Clean up any double slashes created by the removal
  path = path.replace(/\/+/g, "/");

  // Strip trailing slash unless the entire path is just "/"
  if (path.length > 1 && path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  return path;
}

export interface HistoryAdapter {
  getPath(): string;
  getSearch(): string;
  getKey(): string;
  getIndex(): number;
  push(url: string): void;
  replace(url: string): void;
}

export function createHistoryAdapter(useHash: boolean): HistoryAdapter {
  let currentIndex = window.history.state?.index || 0;

  if (window.history.state?.index === undefined) {
    window.history.replaceState({ ...window.history.state, key: Date.now().toString(), index: currentIndex }, "");
  }

  const getPath = useHash ? () => window.location.hash.slice(1).split("?")[0] || "/" : () => window.location.pathname;
  const getSearch = useHash
    ? () => {
        const hash = window.location.hash;
        const searchIndex = hash.indexOf("?");
        return searchIndex !== -1 ? hash.slice(searchIndex) : "";
      }
    : () => window.location.search;

  const getKey = () => window.history.state?.key || "root";
  const getIndex = () => window.history.state?.index || 0;

  return {
    getPath,
    getSearch,
    getKey,
    getIndex,
    push: (url) => {
      currentIndex++;
      const prefix = useHash ? "/#" : "";
      window.history.pushState({ key: uniqueId(), index: currentIndex }, "", prefix + url);
    },
    replace: (url) => {
      const prefix = useHash ? "/#" : "";
      window.history.replaceState({ key: getKey(), index: currentIndex }, "", prefix + url);
    },
  };
}
