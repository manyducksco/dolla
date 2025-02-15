import { noOp, strictEqual } from "../utils";
import { _onWatcherAdded, _onWatcherRemoved } from "./stats";
import { IS_STATE } from "./symbols";

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
   * Default equals check is `===` (strict) equality.
   *
   * @param next - The new value being set.
   * @param current - The current value being replaced.
   */
  equals?: (next: T, current: T) => boolean;
}

export interface WatchOptions<T> {
  /**
   * If true the watch callback will be called for the first time on the next change.
   * Callback is immediately called with the state's current value by default.
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
export type SetAction<I, O = I> = O | SetFunction<I, O>;
export type SetFunction<I, O = I> = (current: I) => O;

/** Callback that updates the value of a state. */
export type Setter<I, O = I> = (value: SetAction<I, O>) => void;

export type MaybeState<T> = State<T> | T;

/*==============================*\
||            Utils             ||
\*==============================*/

export function isState<T>(value: any): value is State<T> {
  return value?.[IS_STATE] === true;
}

/**
 * Retrieves a plain value from a variable that may be a state.
 *
 * @deprecated
 */
export function toValue<T>(source: MaybeState<T>): T {
  if (isState(source)) {
    return source.get();
  } else {
    return source;
  }
}

/**
 * Ensures a variable that may be a state or plain value is a state.
 *
 * @deprecated
 */
export function toState<T>(value: MaybeState<T>): State<T> {
  if (isState<T>(value)) {
    return value;
  } else {
    return new Signal({
      get() {
        return value;
      },
      watch(callback, options = {}) {
        if (!options?.lazy) {
          callback(value);
        }
        return noOp;
      },
    });
  }
}

/*==============================*\
||             State            ||
\*==============================*/

/**
 * ValueHolder implements the core functionality of a State.
 * It holds a value, which can be retrieved with `get`, updated with `set` and observed with `watch`.
 * The user-facing API splits up access into a read-only State and a setter function.
 */
export class ValueHolder<T> implements State<T> {
  value: T;
  watchers: ((value: T) => void)[] = [];
  equals = strictEqual;

  constructor(value: T, options?: CreateStateOptions<T>) {
    this.value = value;
    if (options?.equals) {
      this.equals = options.equals;
    }
  }

  get() {
    return this.value;
  }

  set(action: T | SetFunction<T>) {
    if (typeof action === "function") {
      action = (action as SetFunction<T>)(this.value);
    }

    if (!this.equals(action, this.value)) {
      this.value = action;

      try {
        for (const watcher of this.watchers) {
          watcher(action);
        }
      } catch (err) {
        console.error("Error in watcher", err);
        throw err;
      }
    }
  }

  watch(callback: (value: T) => void, options?: WatchOptions<T>) {
    this.watchers.push(callback);

    if (!options?.lazy) {
      callback(this.value);
    }

    _onWatcherAdded();

    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }

      _onWatcherRemoved();
    };
  }
}

/**
 * Signal is the implementation of a read-only State.
 */
export class Signal<T> implements State<T> {
  [IS_STATE] = true;

  __value;

  constructor(value: State<T>) {
    this.__value = value;
  }

  get() {
    return this.__value.get();
  }

  watch(callback: (value: T) => void, options?: WatchOptions<T>) {
    return this.__value.watch(callback, options);
  }
}

/**
 * Creates a state and setter.
 *
 * @deprecated
 */
export function createState<T>(value: T, options?: CreateStateOptions<T>): [State<T>, Setter<T>];

/**
 * Creates a state and setter.
 *
 * @deprecated
 */
export function createState<T>(
  value?: T,
  options?: CreateStateOptions<T | undefined>,
): [State<T | undefined>, Setter<T | undefined>];

/**
 * Creates a state and setter.
 *
 * @deprecated
 */
export function createState<T>(value: T, options?: CreateStateOptions<T>): [State<T>, Setter<T>] {
  const holder = new ValueHolder(value, options);
  const signal = new Signal(holder);

  return [signal, (action) => holder.set(action)];
}

/*==============================*\
||        Derived States        ||
\*==============================*/

const EMPTY = Symbol("EMPTY");

class DerivedValueHolder<I extends MaybeState<any>[], O> implements State<O> {
  equals = strictEqual;

  /**
   * Array of states this holder's value is derived from.
   */
  sources: State<any>[] = [];
  /**
   * The function that does the deriving. Receives source values and returns a derived value.
   */
  fn: (...values: StateValues<I>) => MaybeState<O>;
  /**
   *
   */
  sourceWatcher = createWatcher();
  /**
   * Array of functions awaiting notification when this holder's value changes.
   */
  watchers: ((value: O) => void)[] = [];
  /**
   * True when this holder is actively watching sources.
   */
  isWatchingSources = false;

  /**
   * Latest values as received from sources.
   */
  previousSourceValues: StateValues<I>;

  /**
   * The current value as returned from `fn` (may be a State)
   */
  value: typeof EMPTY | MaybeState<O> = EMPTY;
  /**
   * The current unwrapped value.
   */
  rawValue!: O;

  /**
   * When value is a State, this function will stop watching its value.
   */
  stopWatchingCurrentValue?: StopFunction;

  constructor(states: [...I], fn: (...values: StateValues<I>) => MaybeState<O>, options?: DeriveOptions) {
    this.sources = states.map(toState);
    this.fn = fn;

    if (options?.equals) {
      this.equals = options.equals;
    }

    this.previousSourceValues = new Array(states.length).fill(EMPTY, 0, states.length) as StateValues<I>;
  }

  /*==========================*\
  ||     "Public" methods     ||
  \*==========================*/

  get(): O {
    return this.getValue();
  }

  watch(callback: (value: O) => void, options?: WatchOptions<O>): StopFunction {
    if (!this.isWatchingSources) {
      this.startWatchingSources();
    }

    const watchers = this.watchers;

    watchers.push(callback);

    if (!options?.lazy) {
      callback(this.rawValue);
    }

    _onWatcherAdded();

    return () => {
      watchers.splice(watchers.indexOf(callback), 1);

      if (this.isWatchingSources && watchers.length === 0) {
        this.stopWatchingSources();
      }

      _onWatcherRemoved();
    };
  }

  /*==========================*\
  ||         Internal         ||
  \*==========================*/

  notify(value: O) {
    for (const watcher of this.watchers) {
      watcher(value);
    }
  }

  update() {
    const sources = this.sources;
    const sourceValues = this.previousSourceValues;
    let changed = false;
    let value: any;

    for (let i = 0; i < sources.length; i++) {
      value = sources[i].get();
      if (!changed && !this.equals(value, sourceValues[i])) {
        changed = true;
      }
      sourceValues[i] = value;
    }

    // We are assuming purity of `fn`, wherein a change in source values means a different output and vice versa.
    if (changed) {
      this.setValue(this.fn(...sourceValues));
    }
  }

  getValue() {
    // Current value will always be up to date when watching sources.
    if (!this.isWatchingSources) {
      this.update();
    }
    return this.rawValue;
  }

  setValue(value: O | State<O>) {
    // Stop watching current value if it was a state.
    if (this.stopWatchingCurrentValue) {
      this.stopWatchingCurrentValue();
      this.stopWatchingCurrentValue = undefined;
    }

    this.value = value;
    this.rawValue = toValue(value);

    if (this.isWatchingSources && isState(value)) {
      this.stopWatchingCurrentValue = value.watch((current) => {
        this.rawValue = current;
        this.notify(current);
      });
    } else {
      this.notify(this.rawValue);
    }
  }

  startWatchingSources() {
    const sourceValues = this.previousSourceValues;

    for (let i = 0; i < this.sources.length; i++) {
      this.sourceWatcher.watch([this.sources[i] as State<any>], (next) => {
        sourceValues[i] = next;

        // This boolean is set after all sources have been watched.
        // We want to update previousSourceValues, but not actually run `fn` yet.
        if (this.isWatchingSources) {
          const value = this.fn(...sourceValues);
          if (!this.equals(value, this.value)) {
            this.setValue(value);
          }
        }
      });
    }

    this.isWatchingSources = true;

    const value = this.fn(...sourceValues);
    if (!this.equals(value, this.value)) {
      this.setValue(value);
    }
  }

  stopWatchingSources() {
    this.sourceWatcher.stopAll();

    // Stop watching current value if it was a state.
    if (this.stopWatchingCurrentValue) {
      this.stopWatchingCurrentValue();
      this.stopWatchingCurrentValue = undefined;
    }

    this.isWatchingSources = false;
  }
}

export interface DeriveOptions {
  equals?: (next: unknown, current: unknown) => boolean;
}

/**
 * Derives a new `State` from one or more existing states.
 *
 * @param sources - Array of source states to track.
 * @param fn - A function called to recompute the value when any tracked source states receive a new value.
 *
 * @deprecated
 *
 * @example
 * // With one source...
 * const [$count, setCount] = createState(5);
 * const $doubled = derive([$count], count => count * 2);
 * // ... or many:
 * const [$greeting, setGreeting] = createState("Hello");
 * const [$name, setName] = createState("World");
 * const $hello = derive([$greeting, name], (greeting, name) => `${greeting}, ${name}!`);
 */
export function derive<Sources extends MaybeState<any>[], T>(
  sources: [...Sources],
  fn: (...values: StateValues<Sources>) => T | State<T>,
  options?: DeriveOptions,
): State<T> {
  const value = new DerivedValueHolder(sources, fn, options);
  return new Signal(value);
}

/*===========================*\
||          Watcher          ||
\*===========================*/

export interface StateWatcher {
  /**
   * Watch one or more states, calling the provided `fn` each time one of their values changes.
   *
   * @param states - An array of states or plain values. States will be unwrapped before being passed to `fn`.
   * @param fn - A function that takes the values of `states` in the same order they were passed.
   */
  watch<I extends MaybeState<any>[]>(states: [...I], fn: (...currentValues: StateValues<I>) => void): StopFunction;

  /**
   * Stop all watch callbacks registered to this watcher.
   */
  stopAll(): void;
}

/**
 * @deprecated
 */
export function createWatcher(): StateWatcher {
  const stopFns: StopFunction[] = [];

  return {
    watch(states, fn) {
      if (states.length === 0) {
        throw new TypeError(`Expected at least one state to watch.`);
      }
      states = states.map(toState) as any;

      let stop: StopFunction;

      if (states.length > 1) {
        stop = derive(states, fn).watch(() => null);
      } else {
        stop = states[0].watch(fn);
      }

      stopFns.push(stop);

      return () => {
        let index = stopFns.indexOf(stop);
        if (index > -1) {
          stopFns.splice(index, 1);
        }
        stop();
      };
    },

    stopAll() {
      while (stopFns.length > 0) {
        const stop = stopFns.pop()!;
        stop();
      }
    },
  };
}
