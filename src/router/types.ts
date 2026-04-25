import type { Setter, Getter, MarkupNode, Renderable, View, MaybeGetter } from "../core";
import type { Context } from "../core/context";
import type { Match } from "./utils";

export type Stringable = { toString(): string };

export type LazyLoader<Props = any> = () => Promise<{ default: View<Props> } | View<Props>>;

export interface LazyView<Props = any> {
  _lazy: true;
  load: LazyLoader<Props>;
}

export interface Route<Data = any> {
  /**
   * The path or path fragment to match.
   */
  path: string;

  /**
   * Path to redirect to when this route is matched, or a callback function that returns such path.
   */
  redirect?: string | ((match: Match) => string) | ((match: Match) => Promise<string>);

  preload?: (match: Match) => Data | Promise<Data>;

  /**
   * View to display when this route is matched.
   */
  view?: View<{ data?: Data; children: Renderable }> | LazyView<{ data?: Data; children: Renderable }>;

  errorView?: View<{ error: Error }>;

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
  meta?: Record<string | symbol, any>;
}

export interface RouteLayer {
  id: string;
  pattern: string; // The route pattern up to this specific layer
  view: View<any> | LazyView<any>;
  errorView?: View<{ error: Error }>;
  preload?: (match: Match) => any | Promise<any>;
}

/**
 * An active route layer whose markup has been initialized into a view.
 */
export interface ActiveLayer {
  id: string;
  key: string;
  node: MarkupNode;
  context: Context;
  slot: Getter<MarkupNode | undefined>;
  setSlot: Setter<MarkupNode | undefined>;
}

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

  /**
   * Persist query params between pages when navigating. Pass an array to specify a list of params that will be preserved.
   * By default all query params are cleared when navigating to a new URL (equivalent to `false`).
   */
  preserveQuery?: boolean | string[];
}

export interface Router {
  /**
   * The current path as it is displayed in the URL bar (e.g. `/users/123/edit`).
   */
  path: Getter<string>;
  /**
   * The route pattern that was matched (e.g. `/users/{#id}/edit`), or undefined if no route is currently matched.
   */
  pattern: Getter<string | undefined>;
  /**
   * The extracted route parameters from the path. (e.g. `{ id: "123" }`)
   */
  params: Getter<Record<string, string>>;
  /**
   * The current query params.
   */
  query: Getter<Record<string, string>>;
  /**
   * The contents of the `meta` fields of all matched route layers.
   */
  meta: Getter<Record<string, string>>;
  /**
   * Represents the loading progress of the current navigation from 0 to 1.
   * Returns 0 when no navigation is pending.
   */
  progress: Getter<number>;

  /**
   * Update query params without changing the route.
   * Keys with a value of `null` will be deleted.
   */
  setQuery(params: Record<string, string | number | null>): Record<string, string>;

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

  /**
   * Prevents attempted navigations if the condition returns true.
   */
  block(guard: () => boolean | Promise<boolean>): () => void;

  /**
   * Contains `true` when the current route matches `path`.
   */
  isActive(path: MaybeGetter<string>, exact?: boolean): Getter<boolean>;
}
