import { colorFromString, noOp } from "./utils";

/**
 * Counts total active state watchers for the purpose of tracking memory leaks.
 */
const tracker = {
  watcherCount: 0,
  increment() {
    this.watcherCount++;
    this._log();
  },
  decrement() {
    this.watcherCount--;
    this._log();
  },

  _label: "dolla/state-tracker",
  _timeout: null as any,
  _log() {
    if ((window as any).DOLLA_DEV_DEBUG === true && !this._timeout) {
      this._timeout = setTimeout(() => {
        console.log(
          `%c[DOLLA_DEV_DEBUG] %c${this._label}%c%c%c`,
          `color:#e44c4c;font-weight:bold`,
          `color:${colorFromString(this._label)};font-weight:bold`,
          `color:#777`,
          `color:#aaa`,
          `color:#777`,
          { watcherCount: this.watcherCount },
        );
        this._timeout = null;
      }, 200);
    }
  },
};

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
export type SetAction<I, O = I> = O | SetFunction<I, O>;
export type SetFunction<I, O = I> = (current: I) => O;

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

export interface Ref<T extends Node> extends State<T | undefined> {
  node: T | undefined;
}

/*==============================*\
||            Utils             ||
\*==============================*/

const TYPE_STATE = Symbol("State");
const TYPE_SETTABLE_STATE = Symbol("SettableState");
const TYPE_REF = Symbol("Ref");

export function isState<T>(value: any): value is State<T> {
  return value?.[TYPE_STATE] === true;
}

export function isSettableState<T>(value: any): value is SettableState<T> {
  return value?.[TYPE_SETTABLE_STATE] === true;
}

export function isRef<T extends Node>(value: any): value is Ref<T> {
  return value?.[TYPE_REF] === true;
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
    return new Signal(value);
  } else if (isState<T>(value)) {
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

export class ValueHolder<T> implements State<T> {
  static defaultEquals(next: any, current: any): boolean {
    return next === current;
  }

  value: T;
  watchers: ((value: T) => void)[] = [];
  equals = ValueHolder.defaultEquals;

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

    tracker.increment();

    return () => {
      const index = this.watchers.indexOf(callback);
      if (index > -1) {
        this.watchers.splice(index, 1);
      }

      tracker.decrement();
    };
  }
}

export class Signal<T> implements State<T> {
  // Instances will pass isState() with this symbol
  [TYPE_STATE] = true;

  __value: State<T>;

  constructor(value: State<T>) {
    if (value == null) {
      throw new TypeError(`Value is null`);
    }
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
  const value = new ValueHolder(initialValue, options);
  const signal = new Signal(value);

  return [signal, (action) => value.set(action)];
}

/*==============================*\
||       Settable States        ||
\*==============================*/

export class SettableSignal<T> implements State<T>, SettableState<T> {
  // Instances will pass isState() and isSettableState() with these symbols
  [TYPE_STATE] = true;
  [TYPE_SETTABLE_STATE] = true;

  __value: ValueHolder<T>;

  constructor(value: ValueHolder<T>) {
    if (value == null) {
      throw new TypeError(`Value is null`);
    }
    this.__value = value;
  }

  get() {
    return this.__value.get();
  }

  set(action: T | ((value: T) => T)) {
    this.__value.set(action);
  }

  watch(callback: (value: T) => void, options?: WatchOptions<T>) {
    return this.__value.watch(callback, options);
  }
}

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
  return new SettableSignal<any>(new ValueHolder(initialValue!, options));
}

/**
 * Join a state and its setter into a single SettableState object.
 */
export function toSettableState<I, O = I>($state: State<I>, setter: Setter<I, O>): SettableState<I, O> {
  return {
    [TYPE_STATE]: true,
    [TYPE_SETTABLE_STATE]: true,

    get: $state.get.bind($state),
    watch: $state.watch.bind($state),
    set: setter,
  } as any;
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

/*==============================*\
||        Derived States        ||
\*==============================*/

const EMPTY = Symbol("EMPTY");

class DerivedValueHolder<I extends MaybeState<any>[], O> implements State<O> {
  equals = ValueHolder.defaultEquals;

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

    tracker.increment();

    return () => {
      watchers.splice(watchers.indexOf(callback), 1);

      if (this.isWatchingSources && watchers.length === 0) {
        this.stopWatchingSources();
      }

      tracker.decrement();
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
    this.rawValue = valueOf(value);

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

export function derive<Inputs extends MaybeState<any>[], T>(
  states: [...Inputs],
  fn: (...currentValues: StateValues<Inputs>) => T | State<T>,
  options?: DeriveOptions,
): State<T> {
  const value = new DerivedValueHolder(states, fn, options);
  return new Signal(value);
}

/*===========================*\
||            Ref            ||
\*===========================*/

class RefSignal<T extends Node> implements State<T | undefined> {
  // Instances will pass isRef() with this symbol
  [TYPE_REF] = true;

  __value: ValueHolder<T | undefined>;

  constructor(value: ValueHolder<T | undefined>) {
    this.__value = value;
  }

  get() {
    return this.__value.get();
  }

  watch(callback: (value: T | undefined) => void, options?: WatchOptions<T>) {
    return this.__value.watch(callback, options);
  }

  get node() {
    return this.__value.get();
  }

  set node(value) {
    this.__value.set(value);
  }
}

/**
 * A special kind of State exclusively for storing references to DOM nodes.
 */
export function createRef<T extends Node>(): Ref<T> {
  return new RefSignal<T>(new ValueHolder<T | undefined>(undefined));
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
