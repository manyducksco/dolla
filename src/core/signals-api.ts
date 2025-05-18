import { SubscriberFlags } from "alien-signals";
import { isFunction } from "../typeChecking";
import {
  activeSub,
  type Computed,
  type Effect,
  link,
  pauseTracking,
  processComputedUpdate,
  processEffectNotifications,
  propagate,
  queueEffect,
  resumeTracking,
  stopEffect,
  type Value,
} from "./signals";

/*===================================*\
||               TYPES               ||
\*===================================*/

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

export type EqualityFunction<T> = (current: T, next: T) => boolean;
export interface SignalOptions<T> {
  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFunction<T>;
}

/*===================================*\
||            PUBLIC API             ||
\*===================================*/

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
export type EffectCallback = () => void | (() => void);

export type UnsubscribeFunction = () => void;

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

export function $<T>(compute: () => MaybeSignal<T>, options?: SignalOptions<T>): Signal<T>;
export function $<T>(value: T, options?: SignalOptions<T>): Source<T>;
export function $<T>(value: undefined, options?: SignalOptions<T>): Source<T | undefined>;
export function $<T>(): Source<T | undefined>;

export function $<T>(init?: (() => T) | T, options?: SignalOptions<T>) {
  if (isFunction(init)) {
    return createSignal(init as () => T, options);
  } else if (init === undefined) {
    return createSource<T | undefined>(undefined, options as SignalOptions<T | undefined>);
  } else {
    return createSource(init, options);
  }
}

/*===================================*\
||             INTERNAL              ||
\*===================================*/

function createSource<T>(initialValue: T, options?: SignalOptions<T>): Source<T> {
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

function createSignal<T>(fn: (cachedValue?: T) => T, options?: SignalOptions<T>): Signal<T> {
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
