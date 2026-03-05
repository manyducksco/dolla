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

export function ref<T = HTMLElement>(): Ref<T> {
  let currentValue: T | undefined;

  return ((value?: T) => {
    if (value) {
      currentValue = value;
      return () => {
        currentValue = undefined;
      };
    } else {
      if (!currentValue) {
        throw new EmptyRefError(`Ref has no value.`);
      }
      return currentValue;
    }
  }) as Ref<T>;
}

export class EmptyRefError extends Error {}
