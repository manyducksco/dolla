export const EMPTY_REF = Symbol("Ref.EMPTY");

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

export function ref<T>(...value: [T]): Ref<T> {
  return _ref.bind({ current: value.length ? value[0] : EMPTY_REF }) as Ref<T>;
}

/*==================================*\
||          Implementation          ||
\*==================================*/

interface RefValue<T> {
  current: T | typeof EMPTY_REF;
}

function _ref<T>(this: RefValue<T>, ...value: [T]): T {
  if (value.length) {
    this.current = value[0];
  } else {
    if (this.current === EMPTY_REF) {
      throw new Error("Ref getter was called, but ref has no value! Be sure to set your refs before accessing them.");
    }
  }
  return this.current;
}
