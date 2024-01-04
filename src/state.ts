import { typeOf } from "@borf/bedrock";
import { deepEqual } from "./utils.js";

// Symbol to mark an observed value as unobserved. Callbacks are always called once for unobserved values.
const UNOBSERVED = Symbol("Unobserved");

// Symbol to access observe method used internally by the library.
export const OBSERVE = Symbol("Observe");

/*==============================*\
||             Types            ||
\*==============================*/

/**
 * Stops the observer that created it when called.
 */
export type StopFunction = () => void;
type ObserveMethod<T> = (callback: (currentValue: T, previousValue?: T) => void) => StopFunction;

/**
 * Extracts value types from an array of Readables.
 */
export type ReadableValues<T extends Readable<any>[]> = {
  [K in keyof T]: T[K] extends Readable<infer U> ? U : never;
};

export type Unwrapped<T> = T extends Readable<infer U> ? U : T;

export interface Observable<T> {
  /**
   * Receives the latest value with `callback` whenever the value changes.
   * The `previousValue` is always undefined the first time the callback is called, then the same value as the last time it was called going forward.
   */
  [OBSERVE]: ObserveMethod<T>;
}

export interface Readable<T> extends Observable<T> {
  /**
   * Returns the current value.
   */
  get(): T;
}

export interface Writable<T> extends Readable<T> {
  /**
   * Sets a new value.
   */
  set(value: T): void;

  /**
   * Passes the current value to `callback` and takes `callback`'s return value as the new value.
   */
  update(callback: (currentValue: T) => T): void;
}

/*==============================*\
||           Utilities          ||
\*==============================*/

export function isObservable<T>(value: any): value is Observable<T> {
  return value != null && typeof value === "object" && typeof value[OBSERVE] === "function";
}

export function isReadable<T>(value: any): value is Readable<T> {
  return (
    value != null &&
    typeof value === "object" &&
    typeof value[OBSERVE] === "function" &&
    typeof value.get === "function"
  );
}

export function isWritable<T>(value: any): value is Writable<T> {
  return isReadable(value) && typeof (value as any).set === "function" && typeof (value as any).update === "function";
}

/*==============================*\
||          readable()          ||
\*==============================*/

export function readable<T>(value: Writable<T>): Readable<Unwrapped<T>>;
export function readable<T>(value: Readable<T>): Readable<Unwrapped<T>>;
export function readable<T>(value: undefined): Readable<T | undefined>;
export function readable<T>(): Readable<T | undefined>;
export function readable<T>(value: T): Readable<Unwrapped<T>>;

export function readable(value?: unknown): Readable<any> {
  // Return a proxy Readable with the value of this Writable.
  if (isWritable(value)) {
    return {
      get: value.get,
      [OBSERVE]: value[OBSERVE],
    };
  }

  // Return the same Readable.
  if (isReadable(value)) {
    return value;
  }

  // Return a new Readable.
  return {
    get: () => value,
    [OBSERVE]: (callback) => {
      callback(value, undefined); // call with current value and undefined for the previous value
      return function stop() {}; // value can never change, so this function is not implemented
    },
  };
}

/*==============================*\
||          writable()          ||
\*==============================*/

export function writable<T>(value: Writable<T>): Writable<Unwrapped<T>>;
export function writable<T>(value: Readable<T>): never; // TODO: How to throw a type error in TS before runtime?
export function writable<T>(value: undefined): Writable<T | undefined>;
export function writable<T>(): Writable<T | undefined>;
export function writable<T>(value: T): Writable<Unwrapped<T>>;

export function writable(value?: unknown): Writable<any> {
  // Return the same Writable.
  if (isWritable(value)) {
    return value;
  }

  // Throw error; can't add write access to a Readable.
  if (isReadable(value)) {
    throw new TypeError(`Failed to convert Readable into a Writable; can't add write access to a read-only value.`);
  }

  const observers: ((currentValue: any, previousValue?: any) => void)[] = [];

  let currentValue = value;

  // Return a new Writable.
  return {
    // ----- Readable ----- //

    get: () => currentValue,
    [OBSERVE]: (callback) => {
      observers.push(callback); // add observer

      function stop() {
        observers.splice(observers.indexOf(callback), 1);
      }

      callback(currentValue, undefined); // call with current value

      // return function to remove observer
      return stop;
    },

    // ----- Writable ----- //

    set: (newValue) => {
      if (!deepEqual(currentValue, newValue)) {
        const previousValue = currentValue;
        currentValue = newValue;
        for (const callback of observers) {
          callback(currentValue, previousValue);
        }
      }
    },
    update: (callback) => {
      const newValue = callback(currentValue);
      if (!deepEqual(currentValue, newValue)) {
        const previousValue = currentValue;
        currentValue = newValue;
        for (const callback of observers) {
          callback(currentValue, previousValue);
        }
      }
    },
  };
}

/*==============================*\
||          observe()           ||
\*==============================*/

/**
 * Observes a readable value. Calls `callback` each time the value changes.
 * Returns a function to stop observing changes. This MUST be called when you are done
 * with this observer to prevent memory leaks.
 */
export function observe<T>(readable: Readable<T>, callback: (currentValue: T, previousValue: T) => void): StopFunction;

/**
 * Observes a set of readable values.
 * Calls `callback` with each value in the same order as `readables` each time any of their values change.
 * Returns a function to stop observing changes. This MUST be called when you are done
 * with this observer to prevent memory leaks.
 */
export function observe<T extends Readable<any>[]>(
  readables: [...T],
  callback: (currentValues: ReadableValues<T>, previousValues: ReadableValues<T>) => void
): StopFunction;

export function observe(readable: any, callback: (...args: any) => void): StopFunction {
  const readables: Readable<any>[] = [];

  if (Array.isArray(readable) && readable.every(isReadable)) {
    readables.push(...readable);
  } else if (isReadable(readable)) {
    readables.push(readable);
  } else {
    console.warn(readable);
    throw new TypeError(
      `Expected one Readable or an array of Readables as the first argument. Got value: ${readable}, type: ${typeOf(
        readable
      )}`
    );
  }

  if (readables.length === 0) {
    throw new TypeError(`Expected at least one readable.`);
  }

  if (readables.length > 1) {
    return computed(readables, callback)[OBSERVE](() => {});
  } else {
    return readables[0][OBSERVE](callback);
  }
}

/*==============================*\
||          computed()          ||
\*==============================*/

export function computed<I, O>(readable: Readable<I>, compute: (currentValue: I, previousValue?: I) => O): Readable<O>;

export function computed<I extends Readable<any>[], O>(
  readables: [...I],
  compute: (currentValues: ReadableValues<I>, previousValues?: ReadableValues<I>) => O
): Readable<O>;

export function computed(...args: any): Readable<any> {
  if (isReadable(args[0])) {
    if (typeof args[1] !== "function") {
      throw new TypeError(
        `When first argument is a Readable the second argument must be a callback function. Got type: ${typeOf(
          args[1]
        )}, value: ${args[1]}`
      );
    }

    const readable = args[0];
    const compute = args[1];

    return {
      get: () => compute(readable.get()),
      [OBSERVE]: (callback) => {
        let lastComputedValue: any = UNOBSERVED;
        let lastObservedValue: any;

        return readable[OBSERVE]((currentValue) => {
          const computedValue = compute(currentValue, lastObservedValue);

          if (!deepEqual(computedValue, lastComputedValue)) {
            const previousValue = lastComputedValue === UNOBSERVED ? undefined : lastComputedValue;
            callback(computedValue, previousValue);
            lastComputedValue = computedValue;
            lastObservedValue = currentValue;
          }
        });
      },
    };
  } else if (Array.isArray(args[0])) {
    if (typeof args[1] !== "function") {
      throw new TypeError(
        `When first argument is an array of Readables the second argument must be a callback function. Got type: ${typeOf(
          args[1]
        )}, value: ${args[1]}`
      );
    }

    if (!args[0].every(isReadable)) {
      throw new TypeError(
        `Computed expected an array of Readables. Got: [${args[0]
          .map((x) => (isReadable(x) ? `Readable<${typeOf(x.get())}>` : typeof x))
          .join(", ")}]`
      );
    }

    const readables = args[0];
    const compute = args[1];

    const observers: ((currentValues: any, previousValues?: any) => void)[] = [];

    let stopCallbacks: StopFunction[] = [];
    let isObserving = false;
    let previousObservedValues: any[] = [];
    let observedValues: any[] = [];
    let latestComputedValue: any = UNOBSERVED;

    function updateValue() {
      const computedValue = compute(observedValues, previousObservedValues);

      // Skip equality check on initial subscription to guarantee
      // that observers receive an initial value, even if undefined.
      if (!deepEqual(computedValue, latestComputedValue)) {
        const previousValue = latestComputedValue === UNOBSERVED ? undefined : latestComputedValue;
        latestComputedValue = computedValue;
        previousObservedValues = observedValues;

        for (const callback of observers) {
          callback(computedValue, previousValue);
        }
      }
    }

    function startObserving() {
      if (isObserving) return;

      for (let i = 0; i < readables.length; i++) {
        const readable = readables[i];

        stopCallbacks.push(
          observe(readable, (value: any) => {
            observedValues[i] = value;

            if (isObserving) {
              updateValue();
            }
          })
        );
      }

      previousObservedValues = new Array<any>().fill(undefined, 0, readables.length);
      observedValues = readables.map((x) => x.get());
      isObserving = true;
      updateValue();
    }

    function stopObserving() {
      isObserving = false;

      for (const callback of stopCallbacks) {
        callback();
      }
      stopCallbacks = [];
    }

    return {
      get: () => {
        if (isObserving) {
          return latestComputedValue;
        } else {
          return compute(
            readables.map((x) => x.get()),
            new Array<any>().fill(undefined, 0, readables.length)
          );
        }
      },
      [OBSERVE]: (callback) => {
        // First start observing
        if (!isObserving) {
          startObserving();
        }

        // Then call callback and add it to observers for future changes
        callback(latestComputedValue, undefined);
        observers.push(callback);

        return function stop() {
          observers.splice(observers.indexOf(callback), 1);

          if (observers.length === 0) {
            stopObserving();
          }
        };
      },
    };
  } else {
    throw new TypeError(
      `Expected a Readable or array of Readables as a first argument. Got: ${typeOf(args[0])}, value: ${args[0]}`
    );
  }
}

/*==============================*\
||           proxy()            ||
\*==============================*/

interface ProxyConfig<Source, Value> {
  get(source: Source): Value;
  set(source: Source, value: Value): void;
}

/**
 * Creates a proxy `Writable` around an existing `Writable`.
 * The config object takes custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
export function proxy<Source extends Writable<any>, Value>(
  source: Source,
  config: ProxyConfig<Source, Value>
): Writable<Value>;

/**
 * Creates a proxy `Writable` around an existing `Readable`.
 * The config object takes custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
export function proxy<Source extends Readable<any>, Value>(
  source: Source,
  config: ProxyConfig<Source, Value>
): Writable<Value>;

export function proxy<Source, Value>(source: Source, config: ProxyConfig<Source, Value>): Writable<Value> {
  // Throw error; can't add write access to a Readable.
  if (!isReadable(source)) {
    throw new TypeError(`Proxy source must be a Readable.`);
  }

  const observers: ((currentValue: any, previousValue?: any) => void)[] = [];
  const currentValue = () => config.get(source);

  // Return a new Writable.
  return {
    // ----- Readable ----- //

    get: () => config.get(source),
    [OBSERVE]: (callback) => {
      let lastComputedValue: any = UNOBSERVED;

      return source[OBSERVE]((_) => {
        const computedValue = config.get(source);

        if (!deepEqual(computedValue, lastComputedValue)) {
          const previousValue = lastComputedValue === UNOBSERVED ? undefined : lastComputedValue;
          callback(computedValue, previousValue);
          lastComputedValue = computedValue;
        }
      });
    },

    // ----- Writable ----- //

    set: (newValue) => {
      config.set(source, newValue);
    },
    update: (callback) => {
      const newValue = callback(config.get(source));
      config.set(source, newValue);
    },
  };
}

/*==============================*\
||           unwrap()           ||
\*==============================*/

export function unwrap<T>(value: Readable<T> | T): T;

export function unwrap(value: any) {
  if (isReadable(value)) {
    return value.get();
  }

  return value;
}
