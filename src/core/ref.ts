const EMPTY_REF = Symbol("Ref.EMPTY");

/**
 * A hybrid getter/setter function that stores the last value it was called with.
 * Guarantees a value is held at runtime by throwing an error if no value is set.
 */
export interface Ref<T> {
  /**
   * Returns the currently stored value of the ref, or throws an error if no value has been set.
   */
  (): T;

  /**
   * Stores a new value to the ref and returns that value.
   */
  (value: T): T;
}

/**
 * Creates a Ref.
 */
export function ref<T>(value?: T): Ref<T>;

export function ref(value = EMPTY_REF) {
  return function () {
    if (arguments.length === 0) {
      if (value === EMPTY_REF) {
        throw new Error(`Ref getter was called, but ref has no value! Be sure to set your refs before accessing them.`);
      }
    } else if (arguments.length === 1) {
      value = arguments[0];
    } else {
      throw new Error(`Ref called with too many arguments. Expected 0 or 1 arguments.`);
    }

    return value;
  };
}
