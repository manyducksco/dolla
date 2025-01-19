import { deepEqual, noOp } from "./utils";

/*==============================*\
||            Types             ||
\*==============================*/

/**
 * Stops the observer that created it when called.
 */
export type StopFunction = () => void;

type Unwrapped<T> = T extends State<infer V> ? V : T;

/**
 * Extracts value types from an array of states.
 */
export type StateValues<T extends MaybeState<any>[]> = {
  [K in keyof T]: Unwrapped<T[K]>;
};

export interface CreateStateOptions<T> {
  /**
   * Determines if the `next` value is equal to the `current` value.
   * If this function returns true, watchers will be notified of changes. If it returns false, watchers will not be notified.
   * By default equality is defined as deep equality.
   *
   * @param next - The new value being set.
   * @param current - The current value being replaced.
   */
  equality?: (next: T, current: T) => boolean;
}

export interface WatchOptions<T> {
  /**
   * If true the watch callback will be called for the first time on the next change.
   * By default the callback is called immediately with the state's current value.
   */
  lazy?: boolean;
}

export interface State<T> {
  /**
   * Returns the current value.
   */
  get(): T;

  /**
   * Watch this state's value with a `callback` function.
   * The `callback` is only called if the value is not equal to the current value.
   *
   * > NOTE: If watching a state inside a view, use the `.watch` method on the `ViewContext`. That method will automatically
   * clean up all watchers when the view is disconnected. Watchers created here must be cleaned up manually.
   */
  watch(callback: (value: T) => void, options?: WatchOptions<T>): StopFunction;
}

/** A new value for a state, or a callback that receives the current value and returns a new one. */
export type SetAction<I, O = I> = O | ((current: I) => O);

/** Callback that updates the value of a state. */
export type Setter<I, O = I> = (value: SetAction<I, O>) => void;

export type MaybeState<T> = State<T> | T;

/**
 * A state and setter in one. Useful for passing states that are intended to be updated by subviews.
 */
export interface SettableState<I, O = I> extends State<I> {
  /**
   * Updates the state's value.
   */
  set(next: O): void;

  /**
   * Takes a callback that recieves the state's current value and returns a new one.
   */
  set(callback: (current: I) => O): void;
}

/*==============================*\
||            Utils             ||
\*==============================*/

export function isState<T>(value: any): value is State<T> {
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

export function isSettableState<T>(value: any): value is SettableState<T> {
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
 * Retrieves a plain value from a variable that may be a state.
 */
export function valueOf<T>(value: MaybeState<T>): T {
  if (isState(value)) {
    return value.get();
  } else {
    return value;
  }
}

/**
 * Ensures a variable that may be a state or plain value is a state.
 */
export function toState<T>(value: MaybeState<T>): State<T> {
  if (isSettableState<T>(value)) {
    return {
      get: value.get,
      watch: value.watch,
    };
  } else if (isState<T>(value)) {
    return value;
  } else {
    return {
      get() {
        return value;
      },
      watch(callback, options = {}) {
        if (!options?.lazy) {
          callback(value);
        }
        return noOp;
      },
    };
  }
}

/*==============================*\
||             State            ||
\*==============================*/

/**
 * Creates a SettableState.
 */
export function createSettableState<T>(initialValue: T, options?: CreateStateOptions<T>): SettableState<T>;

/**
 * Creates a SettableState.
 */
export function createSettableState<T>(
  initialValue?: T,
  options?: CreateStateOptions<T | undefined>,
): SettableState<T | undefined>;

export function createSettableState<T>(initialValue?: T, options?: CreateStateOptions<T>) {
  const [$value, setValue] = createState<any>(initialValue, options);
  return {
    get: $value.get,
    watch: $value.watch,
    set: setValue,
  };
}

/**
 * Join a state and its setter into a single SettableState object.
 */
export function toSettableState<I, O = I>($state: State<I>, setter: Setter<I, O>): SettableState<I, O> {
  return {
    get: $state.get,
    watch: $state.watch,
    set: setter,
  };
}

/**
 * Creates a Setter with custom logic provided by `callback`.
 */
export function createSetter<I, O = I>($state: State<I>, callback: (next: O, current: I) => void): Setter<I, O> {
  return function setValue(nextOrCallback) {
    const current = $state.get();
    let next: O;

    if (typeof nextOrCallback === "function") {
      next = (nextOrCallback as (current: I) => O)(current);
    } else {
      next = nextOrCallback;
    }

    callback(next, current);
  };
}

/**
 * Creates a state and setter.
 */
export function createState<T>(initialValue: T, options?: CreateStateOptions<T>): [State<T>, Setter<T>];

/**
 * Creates a state and setter.
 */
export function createState<T>(
  initialValue?: T,
  options?: CreateStateOptions<T | undefined>,
): [State<T | undefined>, Setter<T | undefined>];

/**
 * Creates a state and setter.
 */
export function createState<T>(initialValue: T, options?: CreateStateOptions<T>): [State<T>, Setter<T>] {
  let currentValue = initialValue;
  let watchers: ((value: T) => void)[] = [];

  function notify() {
    for (const watcher of watchers) {
      watcher(currentValue);
    }
  }

  function equal(next: T, current: T): boolean {
    if (options?.equality) {
      return options.equality(next, current);
    } else {
      return deepEqual(next, current);
    }
  }

  const $value: State<T> = {
    get() {
      return valueOf(currentValue);
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

  function setValue(action: SetAction<T>) {
    let value: T;
    if (typeof action === "function") {
      value = (action as (next: T) => T)(currentValue);
    } else {
      value = action as T;
    }
    if (!equal(value, currentValue)) {
      currentValue = value;
      notify();
    }
  }

  return [$value, setValue];
}

/*==============================*\
||        Derived States        ||
\*==============================*/

export interface DeriveOptions {
  equality?: (next: unknown, current: unknown) => boolean;
}

const EMPTY = Symbol("EMPTY");

export function derive<Inputs extends MaybeState<any>[], T>(
  states: [...Inputs],
  fn: (...currentValues: StateValues<Inputs>) => T | State<T>,
  options?: DeriveOptions,
): State<T> {
  // Wrap any plain values in a static state.
  states = states.map(toState) as [...Inputs];

  let previousSourceValues = new Array(states.length).fill(EMPTY, 0, states.length) as StateValues<Inputs>;
  let currentValue: T | State<T>;

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
   * Stop function for currentValue (used when currentValue is itself a state).
   */
  let stopWatchingCurrentValue: StopFunction | undefined;

  let rawCurrentValue: T;

  function notify(value = getCurrentValue()) {
    for (const watcher of watchers) {
      watcher(value);
    }
  }

  function equal(next: unknown, current: unknown): boolean {
    if (options?.equality) {
      return options.equality(next, current);
    } else {
      return deepEqual(next, current);
    }
  }

  function update() {
    const sourceValues = states.map((s) => s.get()) as StateValues<Inputs>;

    for (let i = 0; i < states.length; i++) {
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
    rawCurrentValue = valueOf(currentValue);
    return rawCurrentValue;
  }

  function setCurrentValue(value: T | State<T>) {
    // If they're the same we don't need to do anything.
    if (value === currentValue) {
      return;
    }

    // Stop watching current value if it was a state.
    if (stopWatchingCurrentValue) {
      stopWatchingCurrentValue();
      stopWatchingCurrentValue = undefined;
    }

    currentValue = value;
    rawCurrentValue = valueOf(value);

    if (isState(value)) {
      if (watching) {
        stopWatchingCurrentValue = value.watch((current) => {
          // TODO: Can we handle infinite nested states?
          const raw = valueOf(current);
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

    for (let i = 0; i < states.length; i++) {
      const state = states[i] as State<any>;
      stoppers.push(
        state.watch((next) => {
          const previous = previousSourceValues[i];
          previousSourceValues[i] = next;

          if (watching && !equal(next, previous)) {
            setCurrentValue(fn(...previousSourceValues));
            notify(valueOf(currentValue));
          }
        }),
      );
    }

    watching = true;

    // Derive and notify watchers if values have changed since last derivation.
    for (let i = 0; i < states.length; i++) {
      if (!equal(previousSourceValues[i], startingSourceValues[i])) {
        setCurrentValue(fn(...previousSourceValues));
        notify(valueOf(currentValue));
        break;
      }
    }
  }

  function stopWatchingSources() {
    for (const stop of stoppers) {
      stop();
    }
    stoppers = [];

    // Stop watching current value if it was a state.
    if (stopWatchingCurrentValue) {
      stopWatchingCurrentValue();
      stopWatchingCurrentValue = undefined;
    }

    watching = false;
  }

  const $value: State<T> = {
    get() {
      return getCurrentValue();
    },
    watch(callback: (value: T) => void, options?: WatchOptions<T>) {
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

export function watch<I extends MaybeState<any>[]>(
  states: [...I],
  fn: (...currentValues: StateValues<I>) => void,
): StopFunction {
  if (states.length === 0) {
    throw new TypeError(`Expected at least one state to watch.`);
  }

  states = states.map(toState) as [...I];

  if (states.length > 1) {
    return derive(states, fn).watch(() => null);
  } else {
    return states[0].watch(fn);
  }
}
