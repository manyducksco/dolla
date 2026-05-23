import type { Store, View } from "../types.js";

/**
 * Simply returns the `fn` passed in, but with inferred types for `this` and `c`.
 * If you provide a typed `props` argument in your callback, the resulting store's type will include it.
 *
 * @example
 * const Whatever = createStore(function (props: WhateverProps) {
 *   this.name = "WhateverStore";
 *
 *   const debug = getDebug(this); // `this` is inferred as `Context`
 *   debug.log("Context inference");
 *
 *   return { value: props.initialValue };
 * });
 */
export function createStore<Props, Value>(fn: Store<Props, Value>): Store<Props, Value> {
  return fn;
}

/**
 * Simply returns the `fn` passed in, but with inferred types for `this` and `c`.
 * If you provide a `props` argument in your callback, the resulting view's type will include it.
 *
 * @example
 * const Whatever = createView(function (props: WhateverProps) {
 *   this.name = "WhateverView";
 *
 *   const debug = getDebug(this); // `this` is inferred as `Context`
 *   debug.log("Context inference");
 *
 *   return <h1>Whatever</h1>;
 * });
 */
export function createView<Props>(fn: View<Props>): View<Props> {
  return fn;
}
