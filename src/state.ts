import { typeOf } from "./typeChecking.js";
import { deepEqual } from "./utils.js";

// Symbol to mark an observed value as unobserved. Callbacks are always called once for unobserved values.
const UNOBSERVED = Symbol("Unobserved");

// Symbol to access observe method used internally by the library.
const OBSERVE = Symbol("Observe");

/*==============================*\
||             Types            ||
\*==============================*/

/**
 * Stops the observer that created it when called.
 */
export type StopFunction = () => void;
type ObserveMethod<T> = (callback: (currentValue: T) => void) => StopFunction;

type Value<T> = T extends Readable<infer V> ? V : T;

/**
 * Extracts value types from an array of Readables.
 */
export type ReadableValues<T extends MaybeReadable<any>[]> = {
  [K in keyof T]: Value<T[K]>;
};

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

export type MaybeReadable<T> = Readable<T> | T;

/*==============================*\
||           Utilities          ||
\*==============================*/

// function isObservable<T>(value: any): value is Observable<T> {
//   return value != null && typeof value === "object" && typeof value[OBSERVE] === "function";
// }

// State.isObservable = isObservable;

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
||          $() and $$()        ||
\*==============================*/

export function $$<T>(value: Writable<T>): Writable<T>;
export function $$<T>(value: Readable<T>): never; // TODO: How to throw a type error in TS before runtime?
export function $$<T>(value: undefined): Writable<T | undefined>;
export function $$<T>(): Writable<T | undefined>;
export function $$<T>(value: T): Writable<Value<T>>;

/**
 * Creates a proxy `Writable` around an existing `Writable`.
 * The config object contains custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
export function $$<Source extends Writable<any>, Value>(source: Source, config: ProxyConfig<Value>): Writable<Value>;

/**
 * Creates a proxy `Writable` around an existing `Readable`.
 * The config object contains custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
export function $$<Source extends Readable<any>, Value>(source: Source, config: ProxyConfig<Value>): Writable<Value>;

// Same as writable()
export function $$(initialValue?: any, config?: any) {
  if (config) {
    return proxy(initialValue, config);
  } else {
    return writable(initialValue);
  }
}

export function $<T>(value: Writable<T>): Readable<T>;
export function $<T>(value: Readable<T>): Readable<T>;
export function $<T>(value: undefined): Readable<T | undefined>;
export function $<T>(): Readable<T | undefined>;
export function $<T>(value: T): Readable<Value<T>>;

export function $<I, O>(state: MaybeReadable<I>, compute: (value: I) => O | Readable<O>): Readable<O>;

export function $<I extends MaybeReadable<any>[], O>(
  states: [...I],
  compute: (...currentValues: ReadableValues<I>) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  compute: (value1: I1, value2: I2) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  compute: (value1: I1, value2: I2, value3: I3) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  compute: (value1: I1, value2: I2, value3: I3, value4: I4) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  compute: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, I6, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  compute: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, I6, I7, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  compute: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, I6, I7, I8, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  compute: (
    value1: I1,
    value2: I2,
    value3: I3,
    value4: I4,
    value5: I5,
    value6: I6,
    value7: I7,
    value8: I8,
  ) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, I6, I7, I8, I9, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  state9: MaybeReadable<I9>,
  compute: (
    value1: I1,
    value2: I2,
    value3: I3,
    value4: I4,
    value5: I5,
    value6: I6,
    value7: I7,
    value8: I8,
    value9: I9,
  ) => O | Readable<O>,
): Readable<O>;

export function $<I1, I2, I3, I4, I5, I6, I7, I8, I9, I10, O>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  state9: MaybeReadable<I9>,
  state10: MaybeReadable<I10>,
  compute: (
    value1: I1,
    value2: I2,
    value3: I3,
    value4: I4,
    value5: I5,
    value6: I6,
    value7: I7,
    value8: I8,
    value9: I9,
    value10: I10,
  ) => O | Readable<O>,
): Readable<O>;

// Hybrid of readable() and computed() - if last arg is a function, it's computed()
export function $(...args: any[]) {
  if (args.length > 1) {
    const callback = args.pop() as (...args: any) => void;
    const readables = args.flat().map(readable);
    return computed(...readables, callback);
  } else {
    return readable(args[0]);
  }
}

/*==============================*\
||          readable()          ||
\*==============================*/

function readable<T>(value: Writable<T>): Readable<T>;
function readable<T>(value: Readable<T>): Readable<T>;
function readable<T>(value: undefined): Readable<T | undefined>;
function readable<T>(): Readable<T | undefined>;
function readable<T>(value: T): Readable<Value<T>>;

function readable(value?: unknown): Readable<any> {
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
      callback(value); // call with current value and undefined for the previous value
      return function stop() {}; // value can never change, so this function is not implemented
    },
  };
}

/*==============================*\
||          computed()          ||
\*==============================*/

function computed(...args: any): Readable<any> {
  const compute = args.pop();
  if (typeof compute !== "function") {
    throw new TypeError(`Final argument must be a function. Got ${typeOf(compute)}: ${compute}`);
  }
  if (args.length < 1) {
    throw new Error(`Must pass at least one value before the callback function.`);
  }
  const readables = args as Readable<any>[];

  const observers: ((...currentValues: any[]) => void)[] = [];

  let stopCallbacks: StopFunction[] = [];
  let isObserving = false;
  let observedValues: any[] = [];
  let valuesChanged: boolean[] = [];
  let latestComputedValue: any = UNOBSERVED;

  // Defined if computed value is itself a readable.
  let computedStopCallback: StopFunction | undefined;

  function updateValue() {
    if (!valuesChanged.some((x) => x)) {
      // No values changed. Nothing to do. No need to recompute.
      return;
    }

    const computedValue = compute(...observedValues);

    if (isReadable(computedValue)) {
      if (computedStopCallback) {
        computedStopCallback();
      }

      computedStopCallback = computedValue[OBSERVE]((current) => {
        latestComputedValue = current;

        for (const callback of observers) {
          callback(current);
        }
      });
    } else if (!deepEqual(computedValue, latestComputedValue)) {
      // Skip equality check on initial subscription to guarantee
      // that observers receive an initial value, even if undefined.

      // Clean up any previous computed readable value.
      if (computedStopCallback) {
        computedStopCallback();
        computedStopCallback = undefined;
      }

      // const previousValue = latestComputedValue === UNOBSERVED ? undefined : latestComputedValue;
      latestComputedValue = computedValue;

      for (const callback of observers) {
        callback(computedValue);
      }
    }

    for (let i = 0; i < observedValues.length; i++) {
      valuesChanged[i] = false;
    }
  }

  function startObserving() {
    if (isObserving) return;

    for (let i = 0; i < readables.length; i++) {
      const readable = readables[i];

      stopCallbacks.push(
        observe(readable, (value: any) => {
          if (!deepEqual(observedValues[i], value)) {
            observedValues[i] = value;
            valuesChanged[i] = true;

            if (isObserving) {
              updateValue();
            }
          }
        }),
      );
    }

    observedValues = readables.map((x) => x.get());
    for (let i = 0; i < observedValues.length; i++) {
      valuesChanged[i] = true;
    }
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
        return compute(...readables.map((x) => x.get()));
      }
    },
    [OBSERVE]: (callback) => {
      // First start observing
      if (!isObserving) {
        startObserving();
      }

      callback(latestComputedValue);
      observers.push(callback);

      return function stop() {
        observers.splice(observers.indexOf(callback), 1);

        if (observers.length === 0) {
          stopObserving();
        }
      };
    },
  };
}

/*==============================*\
||          writable()          ||
\*==============================*/

function writable<T>(value: Writable<T>): Writable<T>;
function writable<T>(value: Readable<T>): never; // TODO: How to throw a type error in TS before runtime?
function writable<T>(value: undefined): Writable<T | undefined>;
function writable<T>(): Writable<T | undefined>;
function writable<T>(value: T): Writable<Value<T>>;

function writable(value?: unknown): Writable<any> {
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

      callback(currentValue); // call with current value

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
||           proxy()            ||
\*==============================*/

interface ProxyConfig<Value> {
  get(): Value;
  set(value: Value): void;
}

/**
 * Creates a proxy `Writable` around an existing `Writable`.
 * The config object takes custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
function proxy<Source extends Writable<any>, Value>(source: Source, config: ProxyConfig<Value>): Writable<Value>;

/**
 * Creates a proxy `Writable` around an existing `Readable`.
 * The config object takes custom `get` and `set` methods.
 * All reads of this proxy goes through the `get` method
 * and all writes go through `set`.
 */
function proxy<Source extends Readable<any>, Value>(source: Source, config: ProxyConfig<Value>): Writable<Value>;

function proxy<Source, Value>(source: Source, config: ProxyConfig<Value>): Writable<Value> {
  // Throw error; can't add write access to a Readable.
  if (!isReadable(source)) {
    throw new TypeError(`Proxy source must be a Readable.`);
  }

  // const observers: ((currentValue: any, previousValue?: any) => void)[] = [];
  // const currentValue = () => config.get();

  // Return a new Writable.
  return {
    // ----- Readable ----- //

    get: () => config.get(),
    [OBSERVE]: (callback) => {
      let lastComputedValue: any = UNOBSERVED;

      return observe(source, (_) => {
        const computedValue = config.get();

        if (!deepEqual(computedValue, lastComputedValue)) {
          // const previousValue = lastComputedValue === UNOBSERVED ? undefined : lastComputedValue;
          callback(computedValue);
          lastComputedValue = computedValue;
        }
      });
    },

    // ----- Writable ----- //

    set: (value) => {
      config.set(value);
    },
    update: (callback) => {
      config.set(callback(config.get()));
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
export function observe<T>(state: Readable<T>, callback: (currentValue: T, previousValue: T) => void): StopFunction;

/**
 * Observes a set of readable values.
 * Calls `callback` with each value in the same order as `readables` each time any of their values change.
 * Returns a function to stop observing changes. This MUST be called when you are done
 * with this observer to prevent memory leaks.
 */
export function observe<T extends MaybeReadable<any>[]>(
  states: [...T],
  callback: (currentValues: ReadableValues<T>, previousValues: ReadableValues<T>) => void,
): StopFunction;

export function observe<I1, I2>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  callback: (value1: I1, value2: I2) => void,
): StopFunction;

export function observe<I1, I2, I3>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  callback: (value1: I1, value2: I2, value3: I3) => void,
): StopFunction;

export function observe<I1, I2, I3, I4>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  callback: (value1: I1, value2: I2, value3: I3, value4: I4) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5, I6>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5, I6, I7>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5, I6, I7, I8>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7, value8: I8) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5, I6, I7, I8, I9>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  state9: MaybeReadable<I9>,
  callback: (
    value1: I1,
    value2: I2,
    value3: I3,
    value4: I4,
    value5: I5,
    value6: I6,
    value7: I7,
    value8: I8,
    value9: I9,
  ) => void,
): StopFunction;

export function observe<I1, I2, I3, I4, I5, I6, I7, I8, I9, I10>(
  state1: MaybeReadable<I1>,
  state2: MaybeReadable<I2>,
  state3: MaybeReadable<I3>,
  state4: MaybeReadable<I4>,
  state5: MaybeReadable<I5>,
  state6: MaybeReadable<I6>,
  state7: MaybeReadable<I7>,
  state8: MaybeReadable<I8>,
  state9: MaybeReadable<I9>,
  state10: MaybeReadable<I10>,
  callback: (
    value1: I1,
    value2: I2,
    value3: I3,
    value4: I4,
    value5: I5,
    value6: I6,
    value7: I7,
    value8: I8,
    value9: I9,
    value10: I10,
  ) => void,
): StopFunction;

export function observe(...args: any[]): StopFunction {
  const callback = args.pop() as (...args: any) => void;
  const readables = args.flat().map(readable);

  if (readables.length === 0) {
    throw new TypeError(`Expected at least one readable.`);
  }

  if (readables.length > 1) {
    return computed(...readables, callback)[OBSERVE](() => null);
  } else {
    return readables[0][OBSERVE](callback);
  }
}

/*==============================*\
||           unwrap()           ||
\*==============================*/

export function unwrap<T>(value: MaybeReadable<T>): T;

export function unwrap(value: any) {
  if (isReadable(value)) {
    return value.get();
  }

  return value;
}
