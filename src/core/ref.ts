import { IS_REF } from "./symbols";

/**
 * A `Ref` is a function that stores a value when called with a single argument,
 * and returns the most recently stored value when called with no arguments.
 */
export interface Ref<T> {
  /**
   * Get: returns the current value stored in the ref (or undefined).
   */
  (): T | undefined;

  /**
   * Set: stores a new `value` in the ref.
   */
  <T>(value: T | undefined): void;
}

/**
 * A Ref is a function that returns the last argument it was called with.
 * Calling it with no arguments will simply return the latest value.
 * Calling it with an argument will store that value and immediately return it.
 *
 * @param value - An (optional) initial value to store.
 *
 * @example
 * const ref = createRef(5);
 * ref(); // 5
 * ref(500);
 * ref(); // 500
 */
export function createRef<T>(value?: T): Ref<T> {
  const ref = function ref() {
    if (arguments.length === 1) {
      value = arguments[0];
    } else if (arguments.length > 1) {
      throw new Error(`Too many arguments. Expected 0 or 1. Got: ${arguments.length}`);
    }
    return value;
  };

  ref[IS_REF] = true;

  return ref;
}

export function isRef<T extends Node>(value: any): value is Ref<T> {
  return value?.[IS_REF] === true;
}
