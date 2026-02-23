import type { MarkupNode, Mutable, Reactive, View } from "../core";
import type { Context } from "../core/context";
import type { QueryParams } from "./query";

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
   * Merged `data` from all matched layers are available on the router's `match.meta`.
   */
  meta: Record<string, any>;
}

export interface RouteMatchContext extends Match {
  /**
   * Redirects the user to a different route instead of matching the current one.
   */
  redirect(path: string): void;
}

export interface GuardState extends Match {
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
   * Arbitrary data you'd like to store on this route.
   * This object is accessible via `match.meta` on the `$router` API while the route is active.
   *
   * In the case of nested routes, data from all layers will be merged into a single data object.
   */
  meta?: Record<string, any>;
}

export interface RouteMeta {
  redirect?: string | ((ctx: RouteRedirectContext) => string) | ((ctx: RouteRedirectContext) => Promise<string>);
  pattern?: string;
  layers?: RouteLayer[];
  guard?: { fn: (ctx: RouteMatchContext) => void | Promise<void>; layerId: string }[];
  data?: Record<string, any>;
}

export interface RouteLayer {
  id: string;
  view: View<{}>;
}

export interface RoutePreloadState {
  // Info passed to preload functions
}

export type RoutePreloadFn = (state: RoutePreloadState) => Promise<void>;

export interface RouteTransitionState {
  // Info passed to transition functions
}

export interface RouteTransitions {
  in?: (state: RouteTransitionState) => Promise<void>;
  out?: (state: RouteTransitionState) => Promise<void>;
}

/**
 * An active route layer whose markup has been initialized into a view.
 */
export interface ActiveLayer {
  id: string;
  node: MarkupNode;
  context: Context;
  slot: Mutable<MarkupNode | undefined>;
}

/**
 * Object passed to redirect callbacks. Contains information useful for determining how to redirect.
 */
export interface RouteRedirectContext extends Match {}

/**
 * A log for a single step in the route resolution process.
 */
export interface JourneyStep {
  kind: "match" | "redirect" | "miss";
  message: string;
}

export interface NavigateOptions {
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

export interface RouterAPI {
  /**
   * Info about the currently matched route.
   */
  match: {
    /**
     * The current path as it is displayed in the URL bar (e.g. `/users/123/edit`).
     */
    path: Reactive<string>;
    /**
     * The route pattern that was matched (e.g. `/users/{#id}/edit`), or undefined if no route is currently matched.
     */
    pattern: Reactive<string | undefined>;
    /**
     * The extracted route parameters from the path. (e.g. `{ id: "123" }`)
     */
    params: Reactive<Record<string, string>>;
    /**
     * The current query params. This is a Writable object that lets you modify query params as well as read them.
     */
    query: QueryParams;
    /**
     * The contents of the `meta` fields of all matched route layers.
     */
    meta: Reactive<Record<string, string>>;
  };

  /**
   * Go back in the page history. Equivalent to hitting the back button.
   * Steps is the number of times to hit the back button. The default is 1.
   */
  back(steps?: number): void;

  /**
   * Go forward in the page history. Equivalent to hitting the forward button.
   * Steps is the number of times to hit the forward button. The default is 1.
   */
  forward(steps?: number): void;

  /**
   * Push a new route into the page history and navigate to it.
   */
  push(path: string): void;

  /**
   * Replace the current route in the page history and navigate to it.
   */
  replace(path: string): void;
}
