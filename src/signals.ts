import { deepEqual } from "./utils";

/*==============================*\
||            Types             ||
\*==============================*/

/**
 * Stops the observer that created it when called.
 */
export type StopFunction = () => void;

type Unwrapped<T> = T extends Signal<infer V> ? V : T;

/**
 * Extracts value types from an array of signals.
 */
export type SignalValues<T extends MaybeSignal<any>[]> = {
  [K in keyof T]: Unwrapped<T[K]>;
};

export interface SignalCreateOptions<T> {
  /**
   * Determines if the `next` value is equal to the `previous` value.
   * If this function returns true, watchers will be notified of changes. If it returns false, watchers will not be notified.
   * By default equality is defined as deep equality.
   *
   * @param next - The new value being set.
   * @param previous - The previous value being replaced.
   */
  equality?: (next: T, previous: T) => boolean;
}

export interface SignalWatchOptions<T> {
  /**
   * If true the watch callback will be called for the first time on the next change.
   * By default the callback is called immediately with the signal's current value.
   */
  lazy?: boolean;
}

export interface Signal<T> {
  /**
   * Returns the current value.
   */
  get(): T;

  /**
   * Watch this signal's value with a `callback` function.
   * The `callback` is only called if the value is not equal to the previous value.
   *
   * > NOTE: If watching a signal inside a view, use the `.watch` method on the `ViewContext`. That method will automatically
   * clean up all watchers when the view is disconnected. Watchers created here must be cleaned up manually.
   */
  watch(callback: (value: T) => void, options?: SignalWatchOptions<T>): StopFunction;
}

export interface SignalSetter<I, O = I> {
  /**
   * Updates the signal's value.
   */
  (value: O): void;

  /**
   * Takes a callback that receives the signal's current value and returns a new one.
   */
  (callback: (current: I) => O): void;
}

export type MaybeSignal<T> = Signal<T> | T;

/**
 * A signal and setter in one. Useful for passing signals that are intended to be updated by subviews.
 */
export interface SettableSignal<I, O = I> extends Signal<I> {
  /**
   * Updates the signal's value.
   */
  set(next: O): void;

  /**
   * Takes a callback that recieves the signal's current value and returns a new one.
   */
  set(callback: (previous: I) => O): void;
}

/*==============================*\
||            Utils             ||
\*==============================*/

export function isSignal<T>(value: any): value is Signal<T> {
  if (value == null || typeof value !== "object") {
    return false;
  }

  if (typeof value["get"] !== "function") {
    return false;
  }

  if (typeof value["watch"] !== "function") {
    return false;
  }

  return true;
}

export function isSettableSignal<T>(value: any): value is Signal<T> {
  if (value == null || typeof value !== "object") {
    return false;
  }

  if (typeof value["set"] !== "function") {
    return false;
  }

  if (typeof value["get"] !== "function") {
    return false;
  }

  if (typeof value["watch"] !== "function") {
    return false;
  }

  return true;
}

/**
 * Retrieves a plain value from a variable that may be a signal.
 */
export function designalify<T>(value: MaybeSignal<T>): T {
  if (isSignal(value)) {
    return value.get();
  } else {
    return value;
  }
}

/**
 * Ensures a variable that may be a signal or plain value is a signal.
 */
export function signalify<T>(value: MaybeSignal<T>): Signal<T> {
  if (isSignal(value)) {
    return value;
  } else {
    return createStaticSignal(value);
  }
}

/*==============================*\
||            Signal            ||
\*==============================*/

export interface signal {
  /**
   * Creates a new Signal and setter.
   */
  // <T>(initialValue: T, options?: SignalCreateOptions<T>): [Signal<T>, SignalSetter<T>];

  /**
   * Creates a new Signal and setter.
   */
  // <T>(
  //   initialValue?: T,
  //   options?: SignalCreateOptions<T | undefined>,
  // ): [Signal<T | undefined>, SignalSetter<T | undefined>];

  /**
   * Creates a SettableSignal with an initial value.
   */
  settable<T>(initialValue: T, options?: SignalCreateOptions<T>): SettableSignal<T>;

  /**
   * Creates a SettableSignal.
   */
  settable<T>(initialValue?: T, options?: SignalCreateOptions<T | undefined>): SettableSignal<T | undefined>;

  /**
   * Combines a Signal and setter into a SettableSignal.
   */
  toSettable<I, O = I>(signal: Signal<I>, setter: SignalSetter<I, O>): SettableSignal<I>;

  /**
   * Creates a SignalSetter with custom logic provided by `callback`.
   */
  createSetter<I, O = I>(signal: Signal<I>, callback: (next: O, previous: I) => void): SignalSetter<I, O>;
}

export function signal<T>(initialValue: T, options?: SignalCreateOptions<T>): [Signal<T>, SignalSetter<T>];
export function signal<T>(
  initialValue?: T,
  options?: SignalCreateOptions<T | undefined>,
): [Signal<T | undefined>, SignalSetter<T | undefined>];

export function signal<T>(initialValue: T, options?: SignalCreateOptions<T>): [Signal<T>, SignalSetter<T>] {
  return createSignal(initialValue, options);
}

signal.settable = createSettableSignal;
signal.toSettable = createSettableSignalFrom;
signal.createSetter = createSignalSetter;

function createSettableSignal<T>(initialValue: T, options?: SignalCreateOptions<T>): SettableSignal<T>;
function createSettableSignal<T>(
  initialValue?: T,
  options?: SignalCreateOptions<T | undefined>,
): SettableSignal<T | undefined>;

function createSettableSignal<T>(initialValue?: T, options?: SignalCreateOptions<T>) {
  const [$value, setValue] = signal<any>(initialValue, options);
  return {
    get: $value.get,
    watch: $value.watch,
    set: setValue,
  };
}

function createSettableSignalFrom<I, O = I>(signal: Signal<I>, setter: SignalSetter<I, O>): SettableSignal<I, O> {
  return {
    get: signal.get,
    watch: signal.watch,
    set: setter,
  };
}

function createSignalSetter<I, O = I>(signal: Signal<I>, callback: (next: O, previous: I) => void): SignalSetter<I, O> {
  return function setValue(nextOrCallback) {
    const previous = signal.get();
    let next: O;

    if (typeof nextOrCallback === "function") {
      next = (nextOrCallback as (previous: I) => O)(previous);
    } else {
      next = nextOrCallback;
    }

    callback(next, previous);
  };
}

/**
 * Creates a minimal signal wrapper around a static value.
 */
function createStaticSignal<T>(value: T): Signal<T> {
  return {
    get() {
      return value;
    },
    watch(callback, options = {}) {
      if (!options.lazy) {
        callback(value);
      }
      return function stop() {
        // no-op because this value can never change.
      };
    },
  };
}

/**
 * Creates a signal and setter.
 */
function createSignal<T>(initialValue: T, options?: SignalCreateOptions<T>): [Signal<T>, SignalSetter<T>] {
  let currentValue = initialValue;
  let watchers: ((value: T) => void)[] = [];

  function notify() {
    for (const watcher of watchers) {
      watcher(currentValue);
    }
  }

  function equal(next: T, previous: T): boolean {
    if (options?.equality) {
      return options.equality(next, previous);
    } else {
      return deepEqual(next, previous);
    }
  }

  const $value: Signal<T> = {
    get() {
      return designalify(currentValue);
    },
    watch(callback, options) {
      // Add callback to watchers array to receive future values.
      watchers.push(callback);

      // Call immediately with current value unless lazy.
      if (!options?.lazy) {
        callback($value.get());
      }

      // Return a function to remove callback from watchers array.
      return function stop() {
        watchers.splice(watchers.indexOf(callback), 1);
      };
    },
  };

  function setValue(next: T): void;
  function setValue(update: (current: T) => T): void;
  function setValue(next: unknown) {
    let value: T;
    if (typeof next === "function") {
      value = next(currentValue);
    } else {
      value = next as T;
    }
    if (!equal(value, currentValue)) {
      currentValue = value;
      notify();
    }
  }

  return [$value, setValue];
}

/*==============================*\
||        Derived Signal        ||
\*==============================*/

export interface SignalDeriveOptions {
  equality?: (next: unknown, previous: unknown) => boolean;
}

const EMPTY = Symbol("EMPTY");

export function derive<Inputs extends MaybeSignal<any>[], T>(
  signals: [...Inputs],
  fn: (...currentValues: SignalValues<Inputs>) => T | Signal<T>,
  options?: SignalDeriveOptions,
): Signal<T> {
  // Wrap any plain values in a static signal.
  signals = signals.map((s) => {
    if (isSignal(s)) {
      return s;
    } else {
      return createStaticSignal(s);
    }
  }) as [...Inputs];

  let previousSourceValues = new Array(signals.length).fill(EMPTY, 0, signals.length) as SignalValues<Inputs>;
  let currentValue: T | Signal<T>;

  /**
   * Watcher callbacks for the derived value.
   */
  let watchers: ((value: T) => void)[] = [];

  /**
   * True when sources are being watched.
   */
  let watching = false;

  /**
   * Stop functions from watched sources.
   */
  let stoppers: StopFunction[] = [];

  /**
   * Stop function for currentValue (used when currentValue is itself a signal).
   */
  let stopWatchingCurrentValue: StopFunction | undefined;

  let rawCurrentValue: T;

  function notify(value = getCurrentValue()) {
    for (const watcher of watchers) {
      watcher(value);
    }
  }

  function equal(next: unknown, previous: unknown): boolean {
    if (options?.equality) {
      return options.equality(next, previous);
    } else {
      return deepEqual(next, previous);
    }
  }

  function update() {
    const sourceValues = signals.map((s) => s.get()) as SignalValues<Inputs>;

    for (let i = 0; i < signals.length; i++) {
      if (!equal(sourceValues[i], previousSourceValues[i])) {
        // Run derive function only if absolutely necessary.
        setCurrentValue(fn(...sourceValues));
        previousSourceValues = sourceValues;
        break;
      }
    }
  }

  function getCurrentValue() {
    // Current value will always be up to date when watching sources.
    if (!watching) {
      update();
    }
    rawCurrentValue = designalify(currentValue);
    return rawCurrentValue;
  }

  function setCurrentValue(value: T | Signal<T>) {
    // If they're the same we don't need to do anything.
    if (value === currentValue) {
      return;
    }

    // Stop watching current value if it was a signal.
    if (stopWatchingCurrentValue) {
      stopWatchingCurrentValue();
      stopWatchingCurrentValue = undefined;
    }

    currentValue = value;
    rawCurrentValue = designalify(value);

    if (isSignal(value)) {
      if (watching) {
        stopWatchingCurrentValue = value.watch((current) => {
          // TODO: Can we handle infinite nested signals?
          const raw = designalify(current);
          if (!equal(raw, rawCurrentValue)) {
            rawCurrentValue = raw;
            notify(raw);
          }
        });
      }
    }
  }

  function startWatchingSources() {
    let startingSourceValues = [...previousSourceValues];

    for (let i = 0; i < signals.length; i++) {
      const signal = signals[i] as Signal<any>;
      stoppers.push(
        signal.watch((next) => {
          const previous = previousSourceValues[i];
          previousSourceValues[i] = next;

          if (watching && !equal(next, previous)) {
            setCurrentValue(fn(...previousSourceValues));
            notify(designalify(currentValue));
          }
        }),
      );
    }

    watching = true;

    // Derive and notify watchers if values have changed since last derivation.
    for (let i = 0; i < signals.length; i++) {
      if (!equal(previousSourceValues[i], startingSourceValues[i])) {
        setCurrentValue(fn(...previousSourceValues));
        notify(designalify(currentValue));
        break;
      }
    }
  }

  function stopWatchingSources() {
    for (const stop of stoppers) {
      stop();
    }
    stoppers = [];

    // Stop watching current value if it was a signal.
    if (stopWatchingCurrentValue) {
      stopWatchingCurrentValue();
      stopWatchingCurrentValue = undefined;
    }

    watching = false;
  }

  const $value: Signal<T> = {
    get() {
      return getCurrentValue();
    },
    watch(callback: (value: T) => void, options?: SignalWatchOptions<T>) {
      if (!watching) {
        startWatchingSources();
      }

      watchers.push(callback);

      if (!options?.lazy) {
        callback(getCurrentValue());
      }

      return function stop() {
        watchers.splice(watchers.indexOf(callback), 1);

        if (watching && watchers.length === 0) {
          stopWatchingSources();
        }
      };
    },
  };

  return $value;
}

export function watch<I extends MaybeSignal<any>[]>(
  signals: [...I],
  fn: (...currentValues: SignalValues<I>) => void,
): StopFunction {
  if (signals.length === 0) {
    throw new TypeError(`Expected at least one signal.`);
  }

  if (signals.some((s) => !isSignal(s))) {
    throw new TypeError(`All values must be signals`);
  }

  signals = signals.map((s) => {
    if (isSignal(s)) {
      return s;
    } else {
      return createStaticSignal(s);
    }
  }) as [...I];

  if (signals.length > 1) {
    return derive(signals, fn).watch(() => null);
  } else {
    return signals[0].watch(fn);
  }
}
