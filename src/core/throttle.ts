import { isFunction } from "../utils";

export type Throttle = {
  call(fn: (...args: any[]) => any): boolean;
  reset(): void;
};

export type BoundThrottle<T extends (...args: any[]) => any> = {
  call(...args: Parameters<T>): boolean;
  reset(): void;
};

export type ThrottleOptions = {};

/**
 * Creates a throttler with a bound function.
 * The throttled function can only fire once every `ms` milliseconds.
 */
export function throttle<Fn extends (...args: any[]) => any>(
  ms: number,
  fn: Fn,
  options?: ThrottleOptions,
): BoundThrottle<Fn>;

/**
 * Creates an unbound throttler that can be called with any function.
 * Returns `true` if the function was called, `false` if it was throttled.
 */
export function throttle(ms: number, options?: ThrottleOptions): Throttle;

export function throttle<Fn extends (...args: any[]) => any>(
  ms: number,
  ...args: [Fn, ThrottleOptions?] | [ThrottleOptions?]
) {
  let fn = isFunction(args[0]) ? (args[0] as Fn) : undefined;
  // let options = (isFunction(args[0]) ? args[1] : args[0]) as ThrottleOptions | undefined;

  let nextAllowedAt = Date.now();

  const reset = () => {
    nextAllowedAt = Date.now();
  };

  return {
    call: (...args: Parameters<Fn> | [Fn]) => {
      const now = Date.now();
      if (now >= nextAllowedAt) {
        nextAllowedAt = now + ms;
        fn ? fn(...(args as Parameters<Fn>)) : args[0]();
        return true;
      }
      return false;
    },
    reset,
  };
}
