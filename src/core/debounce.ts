import { isFunction } from "../utils";
import { Context, onCleanup } from "./context";

export type Debouncer = {
  /**
   * Queues `fn` to be called after the timeout elapses. Replaces the currently queued function (if any) and resets the timer.
   */
  call(fn: (...args: any[]) => any): void;

  /**
   * Immediately calls the currently queued function (if any) and clears the timer.
   */
  flush(): void;

  /**
   * Immediately cancels the queued function (if any).
   */
  cancel(): void;
};

export type BoundDebouncer<T extends (...args: any[]) => any> = {
  /**
   * Queues the bound function to be called with `args` after the timeout elapses. Replaces the currently queued function (if any) and resets the timer.
   */
  call(...args: Parameters<T>): void;

  /**
   * Immediately calls the currently queued function (if any) and clears the timer.
   */
  flush(): void;

  /**
   * Immediately cancels the queued function (if any).
   */
  cancel(): void;
};

export type DebounceOptions = {
  /**
   * An AbortSignal. Cancels the pending function when the `abort` event fires.
   */
  signal?: AbortSignal;

  /**
   * A Dolla Context. Cancels the pending function when the context unmounts.
   */
  context?: Context;
};

/**
 * Creates a debouncer with a bound function.
 */
export function debounce<Fn extends (...args: any[]) => any>(
  ms: number,
  fn: Fn,
  options?: DebounceOptions,
): BoundDebouncer<Fn>;

/**
 * Creates a debouncer that can take any function.
 */
export function debounce(ms: number, options?: DebounceOptions): Debouncer;

export function debounce<Fn extends (...args: any[]) => any>(
  ms: number,
  ...args: [Fn, DebounceOptions?] | [DebounceOptions?]
) {
  let fn = isFunction(args[0]) ? (args[0] as Fn) : undefined;
  let options = (isFunction(args[0]) ? args[1] : args[0]) as DebounceOptions | undefined;

  let pendingTimer: any;
  let pendingFn: () => void;

  const cancel = () => {
    if (pendingTimer) {
      clearTimeout(pendingTimer);
      pendingTimer = undefined;
    }
  };

  const createCaller =
    (fn: Fn, ...args: Parameters<Fn>) =>
    () => {
      cancel();
      fn(...args);
    };

  if (options) {
    if (options.signal) {
      options.signal.addEventListener("abort", cancel);
    }

    if (options.context) {
      onCleanup(options.context, cancel);
    }
  }

  return {
    call: (...args: Parameters<Fn> | [Fn]) => {
      cancel();
      pendingFn = fn ? createCaller(fn, ...(args as Parameters<Fn>)) : args[0];
      pendingTimer = setTimeout(() => {
        pendingFn();
        pendingTimer = undefined;
      }, ms);
    },
    flush: () => {
      if (pendingTimer) {
        cancel();
        pendingFn();
      }
    },
    cancel,
  };
}
