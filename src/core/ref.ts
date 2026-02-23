/**
 * A hybrid getter/setter function that always returns the last value it was called with.
 */
export interface Ref<T = unknown> {
  /**
   * Returns the currently stored value.
   */
  (): T | undefined;

  /**
   * Stores a new value and returns it.
   */
  (value: T | undefined): T | undefined;
}

/**
 * Creates a Ref.
 */
export function ref<T>(): Ref<T>;

/**
 * Creates a Ref.
 */
export function ref<T>(value: T): Ref<T>;

export function ref<T>(value?: T): Ref<T> {
  return _ref.bind({ current: value }) as Ref<T>;
}

/*==================================*\
||          Implementation          ||
\*==================================*/

interface RefValue<T> {
  current?: T;
}

function _ref<T>(this: RefValue<T>, ...value: [T]): T | undefined {
  if (value.length) {
    this.current = value[0];
  }
  return this.current;
}
