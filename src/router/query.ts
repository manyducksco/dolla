import { computed, shallowEqual, type Mutable, type Reactive } from "../core";
import { isFunction } from "../typeChecking";
import { RouterOptions } from "./types";

import { RouteMatch } from "./utils";

export class QueryParams implements Mutable<Record<string, string>> {
  #match: Mutable<RouteMatch | undefined>;
  #options: RouterOptions;
  #params: Reactive<Record<string, string>>;

  constructor(match: Mutable<RouteMatch | undefined>, options: RouterOptions) {
    this.#match = match;
    this.#options = options;
    this.#params = computed(() => this.#match.track()?.query ?? {}, { equals: shallowEqual });
  }

  get() {
    return this.#params.get();
  }

  track() {
    return this.#params.track();
  }

  set(values: Record<string, string>) {
    const path = this.#match.get() ?? window.location.pathname;

    const params = new URLSearchParams();
    for (const key in values) {
      params.append(key, values[key]);
    }
    let queryString = params.toString();

    if (queryString.length > 0) {
      queryString = "?" + queryString;
    }

    this.#match.update((current) => ({ ...current!, query: values }));

    window.history.replaceState(null, "", this.#options.hash ? "/#" + path + queryString : path + queryString);

    return values;
  }

  update(callback: (current: Record<string, string>) => Record<string, string>) {
    const values = callback(this.get());
    return this.set(values);
  }

  /**
   * Applies `values` to the existing query params. `null` values will be removed.
   */
  patch(values: Record<string, string>): Record<string, string>;

  /**
   * Calls `callback` with existing query params. Applies the returned values to the existing query params. `null` values will be removed.
   */
  patch(callback: (current: Record<string, string>) => Record<string, string>): Record<string, string>;

  patch(valuesOrCallback: Record<string, string> | ((current: Record<string, string>) => Record<string, string>)) {
    const current = this.get();
    let values: Record<string, string>;

    if (isFunction<(current: Record<string, string>) => Record<string, string>>(valuesOrCallback)) {
      values = valuesOrCallback(current);
    } else {
      values = valuesOrCallback;
    }

    const merged = { ...current };
    for (const key in values) {
      if (values[key] === null) {
        delete merged[key];
      } else {
        merged[key] = values[key];
      }
    }
    return this.set(merged);
  }
}
