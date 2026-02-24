import { computed, shallowEqual, type Mutable, type Reactive } from "../core";
import { isFunction } from "../typeChecking";
import { RouterOptions } from "./types";

import { RouteMatch } from "./utils";

export class QueryParamsMap {
  #match: Mutable<RouteMatch | undefined>;
  #options: RouterOptions;
  #params: Reactive<Record<string, string>>;

  constructor(match: Mutable<RouteMatch | undefined>, options: RouterOptions) {
    this.#match = match;
    this.#options = options;
    this.#params = computed(() => this.#match.track()?.query ?? {}, { equals: shallowEqual });
  }

  get(): Record<string, string>;
  get(key: string): string | undefined;
  get(key?: string): any {
    const params = this.#params.get();
    if (key) {
      return params[key];
    } else {
      return params;
    }
  }

  track(key: string): string | undefined {
    return this.#params.track()[key];
  }

  set(key: string, value: string): string {
    const path = this.#match.get()?.path ?? window.location.pathname;

    const values = { ...this.#params.get(), [key]: value };

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

    return values[key];
  }

  delete(key: string) {
    const path = this.#match.get()?.path ?? window.location.pathname;

    const values = { ...this.#params.get() };
    let value: string | undefined;

    const params = new URLSearchParams();
    for (const _key in values) {
      if (_key === key) {
        value = values[_key];
      } else {
        params.append(_key, values[_key]);
      }
    }
    let queryString = params.toString();

    if (queryString.length > 0) {
      queryString = "?" + queryString;
    }

    this.#match.update((current) => ({ ...current!, query: values }));

    window.history.replaceState(null, "", this.#options.hash ? "/#" + path + queryString : path + queryString);

    // Return the deleted value.
    return value;
  }

  clear() {
    const path = this.#match.get()?.path ?? window.location.pathname;
    this.#match.update((current) => ({ ...current!, query: {} }));
    window.history.replaceState(null, "", this.#options.hash ? "/#" + path : path);
  }
}

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
    const path = this.#match.get()?.path ?? window.location.pathname;

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
