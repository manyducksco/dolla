import { assert } from "../utils";

export interface Ref<T> {
  /**
   * Call with no arguments to get the stored value.
   * Throws an error if the ref is empty (this means you forgot to pass it or it was called after teardown).
   */
  (): T;

  /**
   * Call with an argument to initialize the value. Returns a cleanup function.
   * The cleanup function should clear any references to the DOM node.
   */
  (value: T): () => void;
}

export function createRef<T = HTMLElement>(): Ref<T> {
  let currentValue: T | undefined;

  return ((...args: [T]) => {
    if (args.length) {
      currentValue = args[0];
      return () => {
        currentValue = undefined;
      };
    } else {
      assert(currentValue !== undefined, "Empty ref!");
      return currentValue;
    }
  }) as Ref<T>;
}
