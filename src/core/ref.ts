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
      return currentValue;
    }
  }) as Ref<T>;
}

/**
 * NOTE: The reason for this structure for refs is a previous 'mixin' feature that let you attach logic to the
 * creation and destruction of an individual DOM node. This design lets you provide a custom ref that can run
 * that logic, either in the initial ref function that takes the node (create) or the cleanup function (destroy).
 *
 * Mixins were removed in favor of ref callbacks to simplify the design.
 */
