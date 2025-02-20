import { createReactiveSystem, type Dependency, type Subscriber, SubscriberFlags } from "alien-signals";
import { isFunction } from "../typeChecking";

/*===================================*\
||               Types               ||
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

export interface Effect extends Subscriber, Dependency {
  name?: string;
  fn(): void;
}

export interface Computed<T = any> extends Signal<T | undefined>, Subscriber {
  name?: string;
  getter: (cachedValue?: T) => T;
  equals: EqualityFunction<T>;
}

export interface Signal<T = any> extends Dependency {
  name?: string;
  currentValue: T;
}

/**
 * A readable reactive state object.
 */
export interface Reactive<T> {
  readonly name?: string;

  /**
   * The current value. Read-only.
   */
  readonly value: T;
}

export interface Atom<T> extends Reactive<T> {
  /**
   * The current value.
   */
  value: T;
}

export type MaybeReactive<T> = Reactive<T> | T;
export type UnsubscribeFunction = () => void;

const IS_REACTIVE = Symbol.for("DollaReactive");
const DEPENDENCY = Symbol("dependency");

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
        startTracking(e);
        try {
          e.fn();
        } finally {
          activeSub = prevSub;
          endTracking(e);
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
  const s: Signal = {
    name: options?.name,
    currentValue: value as T,
    subs: undefined,
    subsTail: undefined,
  };
  const equals = options?.equals ?? Object.is;

  const api = {
    name: options?.name,
    get value() {
      return s.currentValue;
    },
    set value(next) {
      if (!equals(s.currentValue, next)) {
        s.currentValue = next;
        const subs = s.subs;
        if (subs !== undefined) {
          propagate(subs);
          processEffectNotifications();
        }
      }
    },
  };

  Object.defineProperties(api, {
    [IS_REACTIVE]: {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    },
    [DEPENDENCY]: {
      value: s,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });

  return api;
}

type ComposeCallback<T> = (previousValue?: T) => MaybeReactive<T>;

/**
 * Creates a reactive container that derives its value from other reactive values that it tracks.
 *
 * @example
 * const count = atom(1);
 * const doubled = compose(() => get(count) * 2);
 */
export function compose<T>(fn: ComposeCallback<T>, options?: ReactiveOptions<T>): Reactive<T> {
  const c: Computed<T> = {
    name: options?.name,
    currentValue: undefined,
    equals: options?.equals ?? Object.is,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: SubscriberFlags.Computed | SubscriberFlags.Dirty,
    getter: (cachedValue?: unknown) => {
      let returned = fn(cachedValue as T | undefined);

      // If a reactive is returned, track it and return its value.
      returned = get(returned);

      // if (activeSub !== undefined) {
      //   if (activeSub.depsTail === undefined) {
      //     const name = options?.name ?? fn.name;
      //     console.warn(
      //       `Compose function${name ? " '" + name + "'" : ""} has no tracked dependencies and will never update.`,
      //       fn,
      //     );
      //   }
      // }

      return returned;
    },
  };

  const api = {
    name: options?.name,
    get value() {
      const flags = c.flags;
      if (flags & (SubscriberFlags.Dirty | SubscriberFlags.PendingComputed)) {
        processComputedUpdate(c, flags);
      }
      return c.currentValue!;
    },
  };

  Object.defineProperties(api, {
    [IS_REACTIVE]: {
      value: true,
      configurable: false,
      enumerable: false,
      writable: false,
    },
    [DEPENDENCY]: {
      value: c,
      configurable: false,
      enumerable: false,
      writable: false,
    },
  });

  return api;
}

/**
 * Takes a new value to set, or a callback that receives the current value and returns a new value to set.
 */
type Setter<T> = (next: T | ((current: T) => T)) => void;

export function set<T>(atom: Atom<T>): Setter<T>;
export function set<T>(atom: Atom<T>, next: T | ((current: T) => T)): void;

export function set<T>(atom: Atom<T>, next?: T | ((current: T) => T)) {
  // assertInstanceOf(Atom, atom);
  if (isFunction<(current: T) => T>(next)) {
    atom.value = next(atom.value);
  } else if (arguments.length > 1) {
    atom.value = next as T;
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
    if (activeSub !== undefined) {
      const dep = (value as any)[DEPENDENCY] as Dependency;
      link(dep, activeSub);
    }
    return value.value;
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
    return value.value;
  } else {
    return value;
  }
}

export type EffectCallback = () => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to stop watching for changes.
 * If you are using an effect inside a View or Store, use `ctx.effect` instead, which cleans up automatically when the component unmounts.
 */
export function effect(fn: EffectCallback, options?: { name?: string }): UnsubscribeFunction {
  const e: Effect = {
    name: options?.name,
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
