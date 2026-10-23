/**
 * Manages a non-reactive reference, usually to a DOM node.
 * Refs are functions that take a DOM node and return a cleanup function.
 * Refs can be called with no arguments to return the currently held reference.
 */
export interface Ref<T> {
  /**
   * Call with no arguments to get the stored value.
   * Returns `undefined` if the ref has not been set or has been cleaned up.
   */
  (): T;

  /**
   * Call with an argument to initialize the value. Returns a cleanup function.
   * The cleanup function should clear any references to the DOM node.
   */
  (value: T): () => void;
}

/**
 * Creates a ref container for holding a reference to a rendered DOM node.
 */
export function createRef<T = HTMLElement>(): Ref<T> {
  let currentValue: T | undefined;

  return ((...args: [T]) => {
    if (args.length) {
      currentValue = args[0];
      return () => {
        currentValue = undefined;
      };
    } else {
      // assert(currentValue !== undefined, "Empty ref!");
      return currentValue;
    }
  }) as Ref<T>;
}
