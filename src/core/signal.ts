import type { ReactiveFlags, ReactiveNode } from "alien-signals";
import { createReactiveSystem } from "alien-signals/system";
import { isFunction, isObject, typeOf } from "../typeChecking";
import { strictEqual } from "../utils";
import { Context } from "./context";

const enum EffectFlags {
  Queued = 1 << 6,
}

interface EffectScope extends ReactiveNode {}

interface Effect extends ReactiveNode {
  fn(): void | (() => void);
  cleanup?: () => void;
}

interface ComputedGetterState<T> {
  value?: T;
}

interface Computed<T = any> extends ReactiveNode {
  value: T | undefined;
  equals: EqualityFn<T>;

  getter: (this: ComputedGetterState<T>) => T;

  // Temp value set when a computed signal has a value passed to it.
  // This value is held until the real value recomputes.
  holdValue: T | undefined;
}

interface Value<T = any> extends ReactiveNode {
  value: T;
  equals: EqualityFn<T>;

  previousValue: T;
}

const queuedEffects: (Effect | EffectScope | undefined)[] = [];
const { link, unlink, propagate, checkDirty, endTracking, startTracking, shallowPropagate } = createReactiveSystem({
  update(signal: Value | Computed): boolean {
    if ("getter" in signal) {
      return updateComputed(signal);
    } else {
      return updateSignal(signal, signal.value);
    }
  },
  notify,
  unwatched(node: Value | Computed | Effect | EffectScope) {
    if ("getter" in node) {
      let toRemove = node.deps;
      if (toRemove !== undefined) {
        node.flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        do {
          toRemove = unlink(toRemove, node);
        } while (toRemove !== undefined);
      }
    } else if (!("previousValue" in node)) {
      _effect.call(node);
    }
  },
});

let batchDepth = 0;

let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: ReactiveNode | undefined;
let activeScope: EffectScope | undefined;
let activeContext: Context | undefined;

function getCurrentSub(): ReactiveNode | undefined {
  return activeSub;
}

function setCurrentSub(sub: ReactiveNode | undefined) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

export function getCurrentContext(): Context | undefined {
  return activeContext;
}

export function setCurrentContext(context: Context | undefined) {
  const prevContext = activeContext;
  activeContext = context;
  return prevContext;
}

function updateComputed(c: Computed): boolean {
  const prevSub = setCurrentSub(c);
  startTracking(c);
  try {
    const oldValue = c.value;
    const state: ComputedGetterState<any> = { value: c.value };
    // return oldValue !== (c.value = c.getter.call(state));
    return !c.equals(oldValue, (c.value = c.getter.call(state)));
  } finally {
    setCurrentSub(prevSub);
    endTracking(c);
  }
}

function updateSignal(s: Value, value: any): boolean {
  s.flags = 1 satisfies ReactiveFlags.Mutable;
  // return s.previousValue !== (s.previousValue = value);
  return !s.equals(s.previousValue, (s.previousValue = value));
}

function notify(e: Effect | EffectScope) {
  const flags = e.flags;
  if (!(flags & EffectFlags.Queued)) {
    e.flags = flags | EffectFlags.Queued;
    const subs = e.subs;
    if (subs !== undefined) {
      notify(subs.sub as Effect | EffectScope);
    } else {
      queuedEffects[queuedEffectsLength++] = e;
    }
  }
}

function run(e: Effect | EffectScope, flags: ReactiveFlags): void {
  if (
    flags & (16 satisfies ReactiveFlags.Dirty) ||
    (flags & (32 satisfies ReactiveFlags.Pending) && checkDirty(e.deps!, e))
  ) {
    const prev = setCurrentSub(e);
    startTracking(e);
    try {
      if ("cleanup" in e && e.cleanup !== undefined) {
        e.cleanup();
      }
      const result = (e as Effect).fn();
      if ("cleanup" in e && isFunction(result)) {
        e.cleanup = result;
      }
    } finally {
      setCurrentSub(prev);
      endTracking(e);
    }
    return;
  } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
    e.flags = flags & ~(32 satisfies ReactiveFlags.Pending);
  }
  let link = e.deps;
  while (link !== undefined) {
    const dep = link.dep;
    const depFlags = dep.flags;
    if (depFlags & EffectFlags.Queued) {
      run(dep, (dep.flags = depFlags & ~EffectFlags.Queued));
    }
    link = link.nextDep;
  }
}

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!;
    queuedEffects[notifyIndex++] = undefined;
    run(effect, (effect.flags &= ~EffectFlags.Queued));
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

function _computed<T>(this: Computed<T>): T {
  const flags = this.flags;
  if (
    flags & (16 satisfies ReactiveFlags.Dirty) ||
    (flags & (32 satisfies ReactiveFlags.Pending) && checkDirty(this.deps!, this))
  ) {
    if (updateComputed(this)) {
      const subs = this.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
    this.flags = flags & ~(32 satisfies ReactiveFlags.Pending);
  }
  if (activeSub !== undefined) {
    link(this, activeSub);
  } else if (activeScope !== undefined) {
    link(this, activeScope);
  }
  return this.value!;
}

function _getter<T>(this: Value<T>): T {
  const value = this.value;
  if (this.flags & (16 satisfies ReactiveFlags.Dirty)) {
    if (updateSignal(this, value)) {
      const subs = this.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  }
  if (activeSub !== undefined) {
    link(this, activeSub);
  }
  return value;
}

function _setter<T>(this: Value<T>, value: T | ((current: T) => T)): void {
  let next = isFunction(value) ? (get(value(this.value)) as T) : (value as T);
  if (!this.equals(this.value, next)) {
    this.value = next;
    this.flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    const subs = this.subs;
    if (subs !== undefined) {
      propagate(subs);
      if (!batchDepth) {
        flush();
      }
    }
  }
}

function _effect(this: Effect | EffectScope): void {
  let dep = this.deps;
  while (dep !== undefined) {
    dep = unlink(dep, this);
  }
  const sub = this.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
  this.flags = 0 satisfies ReactiveFlags.None;

  if ("cleanup" in this && this.cleanup != null) {
    this.cleanup();
  }
}

/*===================================*\
||                API                ||
\*===================================*/

export function isCombinedAtom<T>(value: any): value is CombinedAtom<T> {
  return isObject(value) && isFunction(value.get);
}

export function isGettable<T>(value: any): value is Gettable<T> {
  return isCombinedAtom(value) || isFunction(value);
}

/* -------------- TYPES --------------- */

/**
 * A function that returns the current value of a signal.
 * Automatically tracked as a dependency when called within a tracking scope (such as `memo` or `effect` functions).
 */
export interface Getter<T> {
  (): T;
}

/**
 * A function that sets the value of the signal.
 */
export interface Setter<T> {
  // This signature is required for Immer `produce` to infer types correctly.
  (value: T | ((current: T) => T)): T;
}

/**
 * Utility type for a value that may be a getter or a plain value.
 * This value can be unwrapped to a plain value with `get` or `untracked` (depending on whether you're in a tracking context and need to track it).
 */
export type MaybeGetter<T> = Getter<T> | T;

/**
 * A getter and setter in a single object.
 */
export interface CombinedAtom<T> {
  get: Getter<T>;
  set: Setter<T>;
}

/**
 * Any type of value that can be unwrapped by the `get` function.
 */
export type Gettable<T> = CombinedAtom<T> | MaybeGetter<T>;

export type EqualityFn<T> = (previousValue: T, nextValue: T) => boolean;

export interface SignalOptions<T> {
  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFn<T>;
}

/* -------------- PUBLIC API --------------- */

/**
 * Creates a new atom, and returns a getter and setter.
 *
 * @example
 * const [count, setCount] = atom(0);
 *
 * count(); // get value
 * setCount(5); // set value
 */
export function atom<T>(value: T, options?: SignalOptions<T>): [Getter<T>, Setter<T>];

export function atom<T>(value: undefined, options: SignalOptions<T>): [Getter<T | undefined>, Setter<T | undefined>];

export function atom<T>(): [Getter<T | undefined>, Setter<T | undefined>];

export function atom<T>(value?: T, options?: SignalOptions<T>): [Getter<T>, Setter<T>] {
  const v: Value<unknown> = {
    previousValue: value as T,
    value: value as T,
    equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
    subs: undefined,
    subsTail: undefined,
    flags: 1 satisfies ReactiveFlags.Mutable,
  };

  return [_getter.bind(v) as Getter<T>, _setter.bind(v) as Setter<T>];
}

/**
 * Returns a single object with a `get` and `set` method from an Atom's getter and setter array.
 *
 * @example
 * const count = combined(atom(0));
 *
 * count.get(); // get value
 * count.set(12); // set value
 */
export function combined<T>(accessors: [Getter<T>, Setter<T>]): CombinedAtom<T> {
  return {
    get: accessors[0],
    set: accessors[1],
  };
}

export interface ComposeOptions<T> extends SignalOptions<T> {
  /**
   * An array of signals this signal depends on. If this is passed, calls to signals within `fn` will NOT be tracked.
   * Instead the `deps` array will be tracked and `fn` will re-run when any value in `deps` changes.
   */
  deps?: Gettable<any>[];
}

/**
 * Creates a composed signal that recomputes its value only when its dependencies change.
 * Subsequent calls will return a cached value.
 * Dependencies are tracked when called inside `fn` by default,
 * but can be overridden by passing a `deps` array in the options object.
 */
export function compose<T>(compute: (previousValue?: T) => Gettable<T>, options?: ComposeOptions<T>): Getter<T> {
  return _computed.bind({
    value: undefined,
    holdValue: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
    getter: function (this: ComputedGetterState<any>) {
      if (options?.deps) {
        for (let dep of options.deps) get(dep);
        return get(peek(() => compute(this.value)));
      }
      return get(compute(this.value));
    },
    equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
  }) as Getter<T>;
}

/**
 * Suspends effects during `fn`. Effects for all updated Signal values are called at the end of the batch.
 */
export function batch(fn: () => void): void {
  ++batchDepth;
  fn();
  if (!--batchDepth) flush();
}

/**
 * Unwraps the plain value from a signal. If the value is not a signal it is returned as-is.
 */
export function get<T>(value: Gettable<T>): T {
  // Handle getter function
  if (isFunction<Getter<T>>(value)) {
    return value();
  }

  // Handle combined atom
  if (isObject(value) && isFunction<Getter<T>>(value.get)) {
    return value.get();
  }

  // Otherwise return value as-is
  return value as T;
}

/**
 * Gets a signal value without tracking the signal.
 */
export function peek<T>(value: Gettable<T>): T {
  let result: T;
  const pausedSub = setCurrentSub(undefined);
  result = get(value);
  setCurrentSub(pausedSub);
  return result;
}

export interface NextValueOptions<T> {
  /**
   * Called each time a new value is received.
   * If `filter` returns false, we keep waiting. If `filter` returns true, that value is resolved.
   */
  filter?: (value: T) => boolean;

  /**
   * An optional AbortSignal that can be used to cancel waiting.
   * When aborted, the promise will reject with an AbortError which you can catch and handle.
   */
  signal?: AbortSignal; // AbortSignal to cancel waiting
}

/**
 * Waits for the next value of `target`. Returns a promise that resolves to the new value.
 */
export function nextValue<T>(target: CombinedAtom<T> | Getter<T>, options?: NextValueOptions<T>): Promise<T> {
  if (!isGettable<T>(target)) {
    throw new Error(`Target must be a Getter function or CombinedAtom. Got: ${typeOf(target)}`);
  }

  return new Promise((resolve, reject) => {
    let initial = true;
    const unsubscribe = effect(() => {
      const value = get(target);

      // Skip the immediate invocation; waiting for next.
      if (initial) {
        initial = false;
        return;
      }

      // If filter exists and returns false, we continue waiting.
      if (options?.filter && !options.filter(value)) {
        return;
      }

      unsubscribe();
      resolve(value);
    });

    if (options?.signal) {
      const onAbort = () => {
        unsubscribe();
        reject(new AbortError());
        options.signal?.removeEventListener("abort", onAbort);
      };
      options.signal.addEventListener("abort", onAbort);
    }
  });
}

export class AbortError extends Error {
  constructor() {
    super("Aborted by AbortController");
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
 * NOTE: You must call the unsubscribe function to clean up the effect.
 * If you are using an effect inside a View or Store, try the `useEffect` hook instead, which cleans up automatically when the component unmounts.
 */
export function effect(fn: EffectFn): UnsubscribeFn {
  const e: Effect = {
    fn,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 2 satisfies ReactiveFlags.Watching,
  };
  if (activeSub !== undefined) {
    link(e, activeSub);
  } else if (activeScope !== undefined) {
    link(e, activeScope);
  }
  const prev = setCurrentSub(e);
  try {
    e.cleanup?.();
    const result = e.fn();
    e.cleanup = isFunction(result) ? result : undefined;
  } finally {
    setCurrentSub(prev);
  }
  return _effect.bind(e);
}
