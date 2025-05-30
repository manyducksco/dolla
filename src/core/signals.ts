import { createReactiveSystem, type Dependency, type Subscriber, SubscriberFlags } from "alien-signals";
import { isFunction } from "../typeChecking";

export interface Effect extends Subscriber, Dependency {
  /**
   * Effect function. Can return an optional cleanup callback to be invoked before the next fn() call.
   */
  fn(): (() => void) | void;

  cleanup?: () => void;
}

export interface Computed<T = any> extends Value<T | undefined>, Subscriber {
  getter: (cachedValue?: T) => T;
  equals: EqualityFn<T>;
}

export interface Value<T = any> extends Dependency {
  current: T;
}

export const {
  link,
  propagate,
  updateDirtyFlag,
  startTracking,
  endTracking,
  processEffectNotifications,
  processComputedUpdate,
  processPendingInnerEffects,
} = createReactiveSystem({
  updateComputed(c: Computed): boolean {
    const prevSub = activeSub;
    activeSub = c;
    startTracking(c);
    try {
      const oldValue = c.current;
      const newValue = c.getter(oldValue);
      if (!c.equals(oldValue, newValue)) {
        c.current = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      endTracking(c);
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

export let activeSub: Subscriber | undefined;

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
        startTracking(e);
        try {
          if (e.cleanup) {
            pauseTracking();
            e.cleanup();
            resumeTracking();
          }
          e.cleanup = e.fn() ?? undefined;
        } finally {
          activeSub = prevSub;
          endTracking(e);
        }
      }
      PENDING_EFFECTS.length = 0;
    });
  }
}

export function queueEffect(e: Effect) {
  PENDING_EFFECTS.push(e);
  flushEffects();
}

export function stopEffect(this: Effect): void {
  startTracking(this);
  endTracking(this);
  // Cancel it after it receives its current value.
  queueMicrotask(() => {
    PENDING_EFFECTS.splice(PENDING_EFFECTS.indexOf(this), 1);
    if (this.cleanup) {
      this.cleanup();
    }
  });
}

const pauseStack: (Subscriber | undefined)[] = [];

export function pauseTracking() {
  pauseStack.push(activeSub);
  activeSub = undefined;
}

export function resumeTracking() {
  activeSub = pauseStack.pop();
}

/*===================================*\
||                API                ||
\*===================================*/

/* -------------- TYPES --------------- */

const SIGNAL = Symbol("SIGNAL");
const SOURCE = Symbol("SOURCE");

/**
 * A getter that returns the current value held within the signal.
 * If called inside a trackable scope this signal will be tracked as a dependency.
 */
export interface Signal<T> {
  (): T;
}

/**
 * Extends Signal with the ability to pass a value or an updater function to change the Signal's value.
 */
export interface Source<T> extends Signal<T> {
  (value: T): void;
  (updater: (value: T) => T): void;
}

export type MaybeSignal<T> = Signal<T> | T;

export type EqualityFn<T> = (current: T, next: T) => boolean;
export interface SignalOptions<T> {
  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFn<T>;
}

/* -------------- PUBLIC API --------------- */

export function isSource<T>(value: MaybeSignal<T>): value is Source<T> {
  return isFunction(value) && (value as any)._type === SOURCE;
}

export function peek<T>(value: MaybeSignal<T>) {
  let result: T;
  pauseTracking();
  result = get(value);
  resumeTracking();
  return result;
}

export function get<T>(value: MaybeSignal<T>) {
  if (isFunction(value)) {
    return (value as () => T)();
  } else {
    return value;
  }
}

/**
 * Function to be invoked for the effect. Can return an optional cleanup function to be called between invocations.
 */
export type EffectFn = () => void | (() => void);

export type UnsubscribeFn = () => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to stop watching for changes.
 * If you are using an effect inside a View or Store, use `ctx.effect` instead, which cleans up automatically when the component unmounts.
 */
export function effect(fn: EffectFn): UnsubscribeFn {
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

export function $<T>(compute: () => MaybeSignal<T>, options?: SignalOptions<T>): Signal<T>;
export function $<T>(value: T, options?: SignalOptions<T>): Source<T>;
export function $<T>(value: undefined, options?: SignalOptions<T>): Source<T | undefined>;
export function $<T>(): Source<T | undefined>;

export function $<T>(init?: (() => T) | T, options?: SignalOptions<T>) {
  if (isFunction(init)) {
    return _createSignal(init as () => T, options);
  } else if (init === undefined) {
    return _createSource<T | undefined>(undefined, options as SignalOptions<T | undefined>);
  } else {
    return _createSource(init, options);
  }
}

/* -------------- INTERNAL --------------- */

function _createSource<T>(initialValue: T, options?: SignalOptions<T>): Source<T> {
  const value: Value<T> = {
    current: initialValue,
    subs: undefined,
    subsTail: undefined,
  };
  const equals = options?.equals ?? Object.is;
  const signal: Signal<any> = function () {
    if (arguments.length > 0) {
      let next = arguments[0] as T;

      if (typeof next === "function") {
        next = next(value.current);
      }

      if (!equals(value.current, next)) {
        value.current = next;
        const subs = value.subs;
        if (subs !== undefined) {
          propagate(subs);
          processEffectNotifications();
        }
      }
    } else {
      if (activeSub !== undefined) {
        link(value, activeSub);
      }
      return value.current;
    }
  };
  (signal as any)._type = SOURCE;

  return signal;
}

function _createSignal<T>(fn: (cachedValue?: T) => T, options?: SignalOptions<T>): Signal<T> {
  if (isFunction(fn) && (fn as any)._type === SIGNAL) {
    if ((fn as any)._type === SOURCE) {
      return (() => fn()) as Signal<T>;
    } else {
      return fn as Signal<T>;
    }
  }

  const computed: Computed<T> = {
    current: undefined,
    equals: options?.equals ?? Object.is,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
    getter: (cachedValue?: T) => {
      const returned = fn(cachedValue);

      // If a signal is returned, track it and return its value.
      return get(returned);
    },
  };
  const signal: Signal<T> = function () {
    if (arguments.length > 0) {
      throw new Error("Signals cannot be set as their values are derived from the sources they depend on.");
    }
    if (activeSub !== undefined) {
      link(computed, activeSub);
    }
    const flags = computed.flags;
    if (flags & (SubscriberFlags.Dirty | SubscriberFlags.PendingComputed)) {
      processComputedUpdate(computed, flags);
    }
    return computed.current!;
  };
  (signal as any)._type = SIGNAL;

  return signal;
}
