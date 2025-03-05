import { createReactiveSystem, type Dependency, type Subscriber, SubscriberFlags } from "alien-signals";
import { isFunction } from "../typeChecking";

export interface Effect extends Subscriber, Dependency {
  fn(): void;
}

export interface Computed<T = any> extends Signal<T | undefined>, Subscriber {
  getter: (cachedValue?: T) => T;
  equals: EqualityFunction<T>;
}

export interface Signal<T = any> extends Dependency {
  currentValue: T;
}

/**
 * A readable reactive state object.
 */
export interface Reactive<T> {
  /**
   * A name provided at the creation of this reactive.
   */
  readonly name?: string;

  /**
   * Returns the current value. Tracks this reactive as a dependency if called within `effect` or `compose`.
   */
  get(): T;

  /**
   * Returns the current value without tracking this reactive as a dependency when called within `effect` or `compose`.
   */
  peek(): T;

  /**
   * The current value.
   * @deprecated use `get()` and `set()`
   */
  readonly value: T;
}

export type MaybeReactive<T> = Reactive<T> | T;
export type UnsubscribeFunction = () => void;

let getTrackedFn: ((tracked: Reactive<unknown>[]) => void) | undefined;
let trackedInThisCycle: Reactive<unknown>[] = [];

const {
  link,
  propagate,
  updateDirtyFlag,
  startTracking,
  endTracking,
  processEffectNotifications,
  processComputedUpdate,
  processPendingInnerEffects,
} = createReactiveSystem({
  updateComputed(computed: Computed): boolean {
    const prevSub = activeSub;
    activeSub = computed;
    trackedInThisCycle.length = 0;
    startTracking(computed);
    try {
      const oldValue = computed.currentValue;
      const newValue = computed.getter(oldValue);
      if (!computed.equals(oldValue, newValue)) {
        computed.currentValue = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      if (getTrackedFn !== undefined) {
        getTrackedFn(trackedInThisCycle);
        getTrackedFn = undefined;
      }
      endTracking(computed);
    }
  },
  notifyEffect(e: Effect) {
    const flags = e.flags;
    if (flags & SubscriberFlags.Dirty || (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(e, flags))) {
      queueEffect(e);
    } else {
      processPendingInnerEffects(e, e.flags);
    }
    return true;
  },
});

/*===================================*\
||        EFFECTS & TRACKING         ||
\*===================================*/

let activeSub: Subscriber | undefined;

const PENDING_EFFECTS: Effect[] = [];

let flushPending = false;

function flushEffects(): void {
  if (!flushPending) {
    flushPending = true;

    queueMicrotask(() => {
      flushPending = false;
      for (let i = 0; i < PENDING_EFFECTS.length; i++) {
        const e = PENDING_EFFECTS[i];
        const prevSub = activeSub;
        activeSub = e;
        trackedInThisCycle.length = 0;
        startTracking(e);
        try {
          e.fn();
        } finally {
          activeSub = prevSub;
          endTracking(e);
          if (getTrackedFn !== undefined) {
            getTrackedFn(trackedInThisCycle);
            getTrackedFn = undefined;
          }
        }
      }
      PENDING_EFFECTS.length = 0;
    });
  }
}

function queueEffect(e: Effect) {
  PENDING_EFFECTS.push(e);
  flushEffects();
}

function stopEffect(this: Effect): void {
  startTracking(this);
  endTracking(this);
  // Cancel it after it receives its current value.
  queueMicrotask(() => {
    PENDING_EFFECTS.splice(PENDING_EFFECTS.indexOf(this), 1);
  });
}

const pauseStack: (Subscriber | undefined)[] = [];

function pauseTracking() {
  pauseStack.push(activeSub);
  activeSub = undefined;
}

function resumeTracking() {
  activeSub = pauseStack.pop();
}

/*===================================*\
||        Types & Core Classes       ||
\*===================================*/

/**
 * A function to compare the current and next values. Returning `true` means the value has changed.
 */
export type EqualityFunction<T> = (current: T, next: T) => boolean;

export interface ReactiveOptions<T> {
  /**
   * A label for debugging purposes.
   */
  name?: string;

  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFunction<T>;
}

export class Atom<T> implements Reactive<T> {
  #signal: Signal<T>;
  #equals;

  readonly name?: string;

  constructor(value: T, options?: ReactiveOptions<T>) {
    this.#signal = {
      currentValue: value as T,
      subs: undefined,
      subsTail: undefined,
    };
    this.#equals = options?.equals ?? Object.is;

    if (options?.name) {
      this.name = options.name;
    }
  }

  /**
   * Returns the latest value. The signal is tracked as a dependency if called within `effect` or `compose`.
   */
  get(): T {
    if (activeSub !== undefined) {
      link(this.#signal, activeSub);
      trackedInThisCycle.push(this);
    }
    return this.#signal.currentValue;
  }

  /**
   * Returns the latest value. The signal is NOT tracked if called within `effect` or `compose`.
   */
  peek(): T {
    return this.#signal.currentValue;
  }

  /**
   * Replaces the current value with `next`.
   *
   * @example
   * const count = atom(0);
   * count.set(2);
   * count.set(count.get() + 1);
   */
  set(next: T): void {
    if (!this.#equals(this.#signal.currentValue, next)) {
      this.#signal.currentValue = next;
      const subs = this.#signal.subs;
      if (subs !== undefined) {
        propagate(subs);
        processEffectNotifications();
      }
    }
  }

  /**
   * Passes the current value to `fn` and sets the return value as the next value.
   *
   * @example
   * const count = atom(0);
   * count.update((current) => current + 1);
   * count.update((current) => current * 5);
   *
   * // Also works very well with Immer `produce` for complex objects.
   * const items = atom([{ name: "Alice", age: 26 }, { name: "Bob", age: 33 }]);
   *
   * // Without Immer:
   * items.update((current) => {
   *   // Return a new array with Bob's age increased by 1.
   *   const newItems = [...current];
   *   newItems[1] = {
   *     ...newItems[1],
   *     age: newItems[1].age + 1
   *   };
   *   return newItems;
   * });
   *
   * // With Immer:
   * import { produce } from "immer";
   *
   * items.update(produce((draft) => {
   *   // Mutate draft to increase Bob's age by 1.
   *   // Results in a new object with this patch applied.
   *   draft[1].age++;
   * }));
   */
  update(fn: (current: T) => T) {
    this.set(fn(this.peek()));
  }

  /**
   * @deprecated use `get()`
   */
  get value(): T {
    return this.peek();
  }

  /**
   * @deprecated use `set()`
   */
  set value(next: T) {
    this.set(next);
  }
}

class Composed<T> implements Reactive<T> {
  #computed: Computed<T>;
  #fn: ComposeCallback<T>;

  readonly name?: string;

  constructor(fn: ComposeCallback<T>, options?: ReactiveOptions<T>) {
    this.#fn = fn;
    this.#computed = {
      currentValue: undefined,
      equals: options?.equals ?? Object.is,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
      getter: this.#getter.bind(this),
    };

    if (options?.name) {
      this.name = options.name;
    }
  }

  #getter(cachedValue?: T) {
    let returned = this.#fn(cachedValue as T | undefined);

    // If a reactive is returned, track it and return its value.
    if (isReactive(returned)) {
      returned = returned.get();
    }

    return returned;
  }

  get(): T {
    if (activeSub !== undefined) {
      link(this.#computed, activeSub);
      trackedInThisCycle.push(this);
    }
    return this.peek();
  }

  peek(): T {
    const computed = this.#computed;
    const flags = computed.flags;
    if (flags & (SubscriberFlags.Dirty | SubscriberFlags.PendingComputed)) {
      processComputedUpdate(computed, flags);
    }
    return computed.currentValue!;
  }

  /**
   * @deprecated use `get()`
   */
  get value(): T {
    return this.peek();
  }
}

/*===================================*\
||        Public API Functions       ||
\*===================================*/

/**
 * Determines if a value is reactive.
 */
export function isReactive<T>(value: any): value is Reactive<T> {
  return value instanceof Atom || value instanceof Composed;
}

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be read and updated with the `value` property
 *
 * @example
 * const count = atom<number>();
 * count.set(5);
 * count.get(); // 5
 */
export function atom<T>(): Atom<T | undefined>;

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be read and updated with the `value` property.
 *
 * @example
 * const count = atom(1);
 * count.set(count.get() + 1);
 * count.get(); // 2
 */
export function atom<T>(value: T, options?: ReactiveOptions<T>): Atom<T>;

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be read and updated with the `value` property.
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
 */
export function atom<T>(value?: T, options?: ReactiveOptions<T>): Atom<T | undefined>;

export function atom<T>(value?: T, options?: ReactiveOptions<T>) {
  return new Atom(value as T, options);
}

type ComposeCallback<T> = (previousValue?: T) => MaybeReactive<T>;

/**
 * Creates a reactive container that derives its value from other reactive values that it tracks.
 *
 * @example
 * const count = atom(1);
 * const doubled = compose(() => count.get() * 2);
 */
export function compose<T>(fn: ComposeCallback<T>, options?: ReactiveOptions<T>): Reactive<T> {
  return new Composed<T>(fn, options);
}

/**
 * Takes a new value to set, or a callback that receives the current value and returns a new value to set.
 */
type Setter<T> = (next: T | ((current: T) => T)) => void;

export function set<T>(atom: Atom<T>): Setter<T>;
export function set<T>(atom: Atom<T>, next: T | ((current: T) => T)): void;

export function set<T>(atom: Atom<T>, next?: T | ((current: T) => T)) {
  if (isFunction<(current: T) => T>(next)) {
    atom.update(next);
  } else if (arguments.length > 1) {
    atom.set(next as T);
  } else {
    return (next: T | ((current: T) => T)) => set(atom, next);
  }
}

/**
 * Returns the current value from a reactive _and track it_ if called in a `compose` or `effect` scope.
 * If a non-reactive value is passed it will just be returned untracked.
 *
 * @example
 * const count = atom(1);
 * const value = get(count); // 1
 *
 * const value = get(5); // 5
 */
export function get<T>(value: MaybeReactive<T>): T {
  if (isReactive(value)) {
    return value.get();
  } else {
    return value;
  }
}

/**
 * Returns the current value from a reactive (without tracking).
 * If a non-reactive value is passed it will be returned.
 *
 * @example
 * ctx.effect(() => {
 *   const doubled = get(count) * 2; // `count` will be tracked
 *
 *   const doubled = peek(count) * 2; // `count` will NOT be tracked
 * });
 */
export function peek<T>(value: MaybeReactive<T>): T {
  if (isReactive(value)) {
    return value.peek();
  } else {
    return value;
  }
}

export function untrack(fn: () => void) {
  pauseTracking();
  fn();
  resumeTracking();
}

/**
 * Registers a callback that will receive a list of dependencies that were tracked within the scope this function was called in.
 */
export function getTracked(fn: (tracked: Reactive<unknown>[]) => void) {
  getTrackedFn = fn;
}

export type EffectCallback = () => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to stop watching for changes.
 * If you are using an effect inside a View or Store, use `ctx.effect` instead, which cleans up automatically when the component unmounts.
 */
export function effect(fn: EffectCallback): UnsubscribeFunction {
  const e: Effect = {
    fn,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Effect,
  };
  if (activeSub !== undefined) {
    link(e, activeSub);
  }
  queueEffect(e);
  return stopEffect.bind(e);
}
