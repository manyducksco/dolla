import { assertString, assertArrayOf, isFunction } from "./typeChecking.js";

export type RouteMatch<T = Record<string, any>> = {
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
  params: Record<string, string | number>;

  /**
   * Query params as parsed from `path`.
   */
  query: Record<string, string | number | boolean>;

  /**
   * Metadata registered to this route.
   */
  meta: T;
};

export enum FragTypes {
  Literal = 1,
  Param = 2,
  Wildcard = 3,
  NumericParam = 4,
}

export type RouteFragment = {
  name: string;
  type: FragTypes;
  value: string | number | null;
};

export type Route<T> = {
  pattern: string;
  fragments: RouteFragment[];
  meta: T;
};

export type RouteMatchOptions<T> = {
  willMatch?: (route: Route<T>) => boolean;
};

/**
 * Separates a URL path into multiple fragments.
 *
 * @param path - A path string (e.g. `"/api/users/5"`)
 * @returns an array of fragments (e.g. `["api", "users", "5"]`)
 */
export function splitPath(path: string): string[] {
  assertString(path, "Expected `path` to be a string. Got type: %t, value: %v");

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
  assertArrayOf(
    (part) => isFunction(part?.toString),
    parts,
    "Expected `parts` to be an array of objects with a .toString() method. Got type: %t, value: %v"
  );

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
  assertString(base, "Expected `base` to be a string. Got type: %t, value: %v");

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

export function parseQueryParams(
  query: string
): Record<string, string | number | boolean> {
  if (!query) return {};

  const entries = query
    .split("&")
    .filter((x) => x.trim() !== "")
    .map((entry) => {
      const [key, value] = entry.split("=").map((x) => x.trim());

      if (value.toLowerCase() === "true") {
        return [key, true] as const;
      }

      if (value.toLowerCase() === "false") {
        return [key, false] as const;
      }

      // Return value as a number if it parses as one.
      if (!isNaN(Number(value))) {
        return [key, Number(value)] as const;
      }

      return [key, value] as const;
    });

  return Object.fromEntries(entries);
}

/**
 * Returns the nearest match, or undefined if the path matches no route.
 *
 * @param url - Path to match against routes.
 * @param options - Options to customize how matching operates.
 */
export function matchRoutes<T>(
  routes: Route<T>[],
  url: string,
  options: RouteMatchOptions<T> = {}
): RouteMatch<T> | undefined {
  const [path, query] = url.split("?");
  const parts = splitPath(path);

  routes: for (const route of routes) {
    const { fragments } = route;
    const hasWildcard =
      fragments[fragments.length - 1]?.type === FragTypes.Wildcard;

    if (!hasWildcard && fragments.length !== parts.length) {
      continue routes;
    }

    if (options.willMatch && !options.willMatch(route)) {
      continue routes;
    }

    const matched: RouteFragment[] = [];

    fragments: for (let i = 0; i < fragments.length; i++) {
      const part = parts[i];
      const frag = fragments[i];

      if (part == null && frag.type !== FragTypes.Wildcard) {
        continue routes;
      }

      switch (frag.type) {
        case FragTypes.Literal:
          if (frag.name.toLowerCase() === part.toLowerCase()) {
            matched.push(frag);
            break;
          } else {
            continue routes;
          }
        case FragTypes.Param:
          matched.push({ ...frag, value: part });
          break;
        case FragTypes.Wildcard:
          matched.push({ ...frag, value: parts.slice(i).join("/") });
          break fragments;
        case FragTypes.NumericParam:
          if (!isNaN(Number(part))) {
            matched.push({ ...frag, value: Number(part) });
            break;
          } else {
            continue routes;
          }
        default:
          throw new Error(`Unknown fragment type: ${frag.type}`);
      }
    }

    const params = Object.create(null);

    for (const frag of matched) {
      if (frag.type === FragTypes.Param) {
        params[frag.name] = decodeURIComponent(frag.value as string);
      }

      if (frag.type === FragTypes.NumericParam) {
        params[frag.name] = frag.value as number;
      }

      if (frag.type === FragTypes.Wildcard) {
        params.wildcard = "/" + decodeURIComponent(frag.value as string);
      }
    }

    return {
      path: "/" + matched.map((f) => f.value).join("/"),
      pattern:
        "/" +
        fragments
          .map((f) => {
            if (f.type === FragTypes.Param) {
              return `{${f.name}}`;
            }

            if (f.type === FragTypes.NumericParam) {
              return `{#${f.name}}`;
            }

            return f.name;
          })
          .join("/"),
      params,
      query: parseQueryParams(query),
      meta: route.meta,
    };
  }
}

/**
 * Sort routes descending by specificity. Guarantees that the most specific route matches first
 * no matter the order in which they were added.
 *
 * Routes without named params and routes with more fragments are weighted more heavily.
 */
export function sortRoutes<T>(routes: Route<T>[]): Route<T>[] {
  const withoutParams = [];
  const withNumericParams = [];
  const withParams = [];
  const wildcard = [];

  for (const route of routes) {
    const { fragments } = route;

    if (fragments.some((f) => f.type === FragTypes.Wildcard)) {
      wildcard.push(route);
    } else if (fragments.some((f) => f.type === FragTypes.NumericParam)) {
      withNumericParams.push(route);
    } else if (fragments.some((f) => f.type === FragTypes.Param)) {
      withParams.push(route);
    } else {
      withoutParams.push(route);
    }
  }

  const bySizeDesc = (a: Route<T>, b: Route<T>) => {
    if (a.fragments.length > b.fragments.length) {
      return -1;
    } else {
      return 1;
    }
  };

  withoutParams.sort(bySizeDesc);
  withNumericParams.sort(bySizeDesc);
  withParams.sort(bySizeDesc);
  wildcard.sort(bySizeDesc);

  return [...withoutParams, ...withNumericParams, ...withParams, ...wildcard];
}

/**
 * Converts a route pattern into a set of matchable fragments.
 *
 * @param route - A route string (e.g. "/api/users/{id}")
 */
export function patternToFragments(pattern: string): RouteFragment[] {
  const parts = splitPath(pattern);
  const fragments = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];

    if (part === "*") {
      if (i !== parts.length - 1) {
        throw new Error(
          `Wildcard must be at the end of a pattern. Received: ${pattern}`
        );
      }
      fragments.push({
        type: FragTypes.Wildcard,
        name: "*",
        value: null,
      });
    } else if (part.at(0) === "{" && part.at(-1) === "}") {
      fragments.push({
        type: part[1] === "#" ? FragTypes.NumericParam : FragTypes.Param,
        name: part[1] === "#" ? part.slice(2, -1) : part.slice(1, -1),
        value: null,
      });
    } else {
      fragments.push({
        type: FragTypes.Literal,
        name: part,
        value: part,
      });
    }
  }

  return fragments;
}
