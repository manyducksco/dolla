import type { ReactiveFlags, ReactiveNode } from "alien-signals";
import { createReactiveSystem } from "alien-signals/system";
import { isFunction, typeOf } from "../typeChecking";
import { strictEqual } from "../utils";
import { Context } from "./context";

const SIGNAL = Symbol("Signal");

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
  getter: (this: ComputedGetterState<T>) => T;
  equals: EqualityFn<T>;

  // Temp value set when a computed signal has a value passed to it.
  // This value is held until the real value recomputes.
  holdValue: T | undefined;
}

interface Value<T = any> extends ReactiveNode {
  previousValue: T;
  value: T;
  equals: EqualityFn<T>;
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
 * A getter and setter in a single object. Callable like a getter, but includes a `set` method for updating the signal's value.
 */
export interface Signal<T> extends Getter<T>, Setter<T> {
  split(): [Getter<T>, Setter<T>];
}

/**
 * Utility type for a value that may be a getter or a plain value.
 * This value can be unwrapped to a plain value with `get` or `untracked` (depending on whether you're in a tracking context and need to track it).
 */
export type MaybeSignal<T> = Getter<T> | T;

export type EqualityFn<T> = (previousValue: T, nextValue: T) => boolean;

export interface SignalOptions<T> {
  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFn<T>;
}

/* -------------- PUBLIC API --------------- */

/**
 * Creates a new signal.
 *
 * @example
 * const [count, setCount] = signal(0);
 *
 * count(); // get
 * setCount(5); // set
 */
export function signal<T>(initialValue: T, options?: SignalOptions<T>): [Getter<T>, Setter<T>];

export function signal<T>(
  initialValue: undefined,
  options: SignalOptions<T>,
): [Getter<T | undefined>, Setter<T | undefined>];

export function signal<T>(): [Getter<T | undefined>, Setter<T | undefined>];

export function signal<T>(initialValue?: T, options?: SignalOptions<T>): [Getter<T>, Setter<T>] {
  const v: Value<unknown> = {
    previousValue: initialValue as T,
    value: initialValue as T,
    equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
    subs: undefined,
    subsTail: undefined,
    flags: 1 satisfies ReactiveFlags.Mutable,
  };

  return [_getter.bind(v) as Getter<T>, _setter.bind(v) as Setter<T>];
}

const VALUE = Symbol("value");

interface State<T> {
  [VALUE]: Value<T>;
}

function isState<T = unknown>(value: any): value is State<T> {
  return Object.hasOwn(value, VALUE);
}

type StateOrValue<T> = State<T> | T;

function _get<T>(target: StateOrValue<T>): T {
  if (isState(target)) {
    // Do get logic
  } else {
    return target as T;
  }
}

function set<T>(state: State<T>, value: T | ((current: T) => T)): T {
  if (!isState(state)) {
    throw new Error(`First argument must be a state. Got: ${typeOf(state)}`);
  }

  // Do set logic
}

function peek<T>(value: MaybeSignal<T>): T {}

export function slot() {
  const [get, set] = signal();
  return { get, set };
}

export interface ComputedOptions<T> extends SignalOptions<T> {
  /**
   * An array of signals this signal depends on. If this is passed, calls to signals within `fn` will NOT be tracked.
   * Instead the `deps` array will be tracked and `fn` will re-run when any value in `deps` changes.
   */
  deps?: Signal<any>[];
}

/**
 * Creates a derived signal that recomputes its value only when its dependencies change.
 * Subsequent calls will return a cached value.
 * Dependencies are tracked when called inside `fn` by default,
 * but can be overridden by passing a `deps` array in the options object.
 */
export function computed<T>(compute: (previousValue?: T) => MaybeSignal<T>, options?: ComputedOptions<T>): Getter<T> {
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
        return get(untracked(() => compute(this.value)));
      }
      return get(compute(this.value));
    },
    equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
  }) as () => T;
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
 * Call a Signal function without tracking its value.
 */
export function untracked<T>(value: MaybeSignal<T>): T {
  if (isFunction(value)) {
    let result: T;
    const pausedSub = setCurrentSub(undefined);
    result = value();
    setCurrentSub(pausedSub);
    return result;
  } else {
    return value;
  }
}

/**
 * Unwraps the plain value from a Signal. If the value is not a Signal it is returned as-is.
 */
export function get<T>(value: MaybeSignal<T>): T {
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
