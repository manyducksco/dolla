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
   * The current value.
   */
  readonly value: T;
}

const IS_REACTIVE = Symbol.for("DollaReactive");
const DEPENDENCY = Symbol("dependency");

export type MaybeReactive<T> = Reactive<T> | T;
export type UnsubscribeFunction = () => void;

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
      endTracking(computed);
    }
  },
  notifyEffect(e: Effect) {
    return notifyEffect(e);
  },
});

/*===================================*\
||        EFFECTS & TRACKING         ||
\*===================================*/

/**
 * If true, add all effects to PENDING_EFFECTS and flush them on the next microtask phase.
 */
let batchEffects = true;

const PENDING_EFFECTS: Effect[] = [];

let flushPending = false;

function flushEffects(): void {
  if (!flushPending) {
    flushPending = true;

    queueMicrotask(() => {
      flushPending = false;
      for (let i = 0; i < PENDING_EFFECTS.length; i++) {
        runEffect(PENDING_EFFECTS[i]);
      }
      PENDING_EFFECTS.length = 0;
    });
  }
}

function queueEffect(e: Effect) {
  PENDING_EFFECTS.push(e);
  flushEffects();
}

function cancelEffect(e: Effect) {
  PENDING_EFFECTS.splice(PENDING_EFFECTS.indexOf(e), 1);
}

const pauseStack: (Subscriber | undefined)[] = [];

// let batchDepth = 0;
let activeSub: Subscriber | undefined;

// export function startBatch() {
//   ++batchDepth;
// }

// export function endBatch() {
//   if (!--batchDepth) {
//     processEffectNotifications();
//   }
// }

export function pauseTracking() {
  pauseStack.push(activeSub);
  activeSub = undefined;
}

export function resumeTracking() {
  activeSub = pauseStack.pop();
}

function runEffect(e: Effect): void {
  const prevSub = activeSub;
  activeSub = e;
  startTracking(e);
  try {
    e.fn();
  } finally {
    activeSub = prevSub;
    endTracking(e);
  }
}

function notifyEffect(e: Effect): boolean {
  const flags = e.flags;
  if (flags & SubscriberFlags.Dirty || (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(e, flags))) {
    if (batchEffects) {
      queueEffect(e);
    } else {
      runEffect(e);
    }
  } else {
    processPendingInnerEffects(e, e.flags);
  }
  return true;
}

function effectStop(this: Subscriber): void {
  startTracking(this);
  endTracking(this);
  // Cancel it after it receives its current value.
  queueMicrotask(() => {
    cancelEffect(this as Effect);
  });
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
  #signal;
  #equals;

  /**
   * A label for debugging purposes.
   */
  name?: string;

  constructor(signal: Signal<T>, options?: ReactiveOptions<T>) {
    this.#signal = signal;
    this.#equals = options?.equals ?? Object.is;

    if (options?.name) {
      this.name = options.name;
    }

    Object.defineProperties(this, {
      [IS_REACTIVE]: {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
      },
      [DEPENDENCY]: {
        value: signal,
        configurable: false,
        enumerable: false,
        writable: false,
      },
    });
  }

  get value(): T {
    if (activeSub !== undefined) {
      link(this.#signal, activeSub);
    }
    return this.#signal.currentValue;
  }

  set value(next: T) {
    if (!this.#equals(this.#signal.currentValue, next)) {
      this.#signal.currentValue = next;
      const subs = this.#signal.subs;
      if (subs !== undefined) {
        propagate(subs);
        // if (!batchDepth) {
        processEffectNotifications();
        // }
      }
    }
  }
}

type Getter = <T>(value: MaybeReactive<T>) => T;

class Composed<T> implements Reactive<T> {
  #computed;

  constructor(computed: Computed<T>) {
    this.#computed = computed;

    Object.defineProperties(this, {
      [IS_REACTIVE]: {
        value: true,
        configurable: false,
        enumerable: false,
        writable: false,
      },
      [DEPENDENCY]: {
        value: computed,
        configurable: false,
        enumerable: false,
        writable: false,
      },
    });
  }

  get value(): T {
    const computed = this.#computed;
    const flags = computed.flags;
    if (flags & (SubscriberFlags.Dirty | SubscriberFlags.PendingComputed)) {
      processComputedUpdate(computed, flags);
    }
    if (activeSub !== undefined) {
      link(computed, activeSub);
    }
    return computed.currentValue!;
  }
}

// interface Atom<T> extends Reactive<T> {
//   name?: string;
//   value: T;
// }

/*===================================*\
||        Public API Functions       ||
\*===================================*/

/**
 * Determines if a value is reactive.
 */
export function isReactive<T>(value: any): value is Reactive<T> {
  return value != null && (value as any)[IS_REACTIVE] === true;
}

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be read and updated with the `value` property
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
 */
export function atom<T>(): Atom<T | undefined>;

/**
 * Creates a simple reactive container that stores a value.
 * Atom values can be read and updated with the `value` property.
 *
 * @example
 * const count = atom(1);
 * count.value++;
 * count.value; // 2
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
  return new Atom({ currentValue: value as T, subs: undefined, subsTail: undefined }, options);
}

/**
 * Creates a reactive container that derives its value from other reactive values.
 * A composed value will track any other reactives whose `value` property was accessed within the body of the function.
 *
 * @example
 * const count = atom(1);
 * const doubled = compose(() => count.value * 2);
 */
export function compose<T>(fn: (get: Getter) => MaybeReactive<T>, options?: ReactiveOptions<T>): Composed<T> {
  return new Composed<T>({
    currentValue: undefined,
    equals: options?.equals ?? Object.is,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
    getter: (cachedValue?: unknown) => {
      let returned = fn(get);

      // If a reactive is returned, track it and return its value.
      if (isReactive(returned)) {
        const dep = (returned as any)[DEPENDENCY] as Dependency;
        if (activeSub !== undefined) {
          link(dep, activeSub);
        }
        returned = returned.value;
      }

      return returned;
    },
  });
}

/**
 * Gets the plain value from a (possibly) reactive value.
 *
 * @example
 * const count = atom(1);
 * const value = get(count); // 1
 *
 * const value = get(5); // 5
 */
export function get<T>(value: MaybeReactive<T>): T {
  if (isReactive(value)) {
    return value.value;
  } else {
    return value;
  }
}

// export function peek<T>(value: Atom<T>): T;

/**
 * Gets the plain value from a (possibly) reactive value _without tracking_.
 *
 * @example
 * ctx.effect(() => {
 *   const doubled = count.value * 2; // `count` will be tracked
 *
 *   const doubled = peek(count) * 2; // `count` will NOT be tracked
 * });
 */
export function peek<T>(value: MaybeReactive<T>): T;

/**
 * Runs a callback `fn`. Anything that happens within it will not be tracked.
 *
 * @example
 * ctx.effect(() => {
 *   const sum = one.value + two.value; // `one` and `two` will be tracked
 *
 *   const sum = peek(() => {
 *     return one.value + two.value; // `one` and `two` will NOT be tracked
 *   });
 * })
 */
export function peek<T>(fn: () => T): T;

export function peek<T>(fnOrValue: (() => T) | MaybeReactive<T>) {
  let value: T;

  pauseTracking();
  if (isFunction(fnOrValue)) {
    value = fnOrValue();
  } else {
    value = get(fnOrValue);
  }
  resumeTracking();

  return value;
}

export type EffectCallback = (getter: Getter) => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to stop watching for changes.
 * If you are using an effect inside a View or Store, use `ctx.effect` instead, which cleans up automatically when the component unmounts.
 */
export function effect(fn: EffectCallback): UnsubscribeFunction {
  const e: Effect = {
    fn: () => {
      fn(get);
    },
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Effect,
  };
  if (activeSub !== undefined) {
    link(e, activeSub);
  }
  if (batchEffects) {
    queueEffect(e);
  } else {
    runEffect(e);
  }
  return effectStop.bind(e);
}
