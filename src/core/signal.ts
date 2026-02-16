import type { ReactiveFlags, ReactiveNode } from "alien-signals";
import { createReactiveSystem } from "alien-signals/system";
import { isFunction, isObject, typeOf } from "../typeChecking";
import { strictEqual } from "../utils";
import { Context } from "./context";
import { getEnv } from "./env";

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

interface ComputedNode<T = any> extends ReactiveNode {
  value: T | undefined;
  equals: EqualityFn<T>;

  getter: (this: ComputedGetterState<T>) => T;

  // Temp value set when a computed signal has a value passed to it.
  // This value is held until the real value recomputes.
  holdValue: T | undefined;
}

interface ValueNode<T = any> extends ReactiveNode {
  value: T;
  equals: EqualityFn<T>;

  previousValue: T;
}

const queuedEffects: (Effect | EffectScope | undefined)[] = [];
const { link, unlink, propagate, checkDirty, endTracking, startTracking, shallowPropagate } = createReactiveSystem({
  update(signal: ValueNode | ComputedNode): boolean {
    if ("getter" in signal) {
      return updateComputed(signal);
    } else {
      return updateSignal(signal, signal.value);
    }
  },
  notify,
  unwatched(node: ValueNode | ComputedNode | Effect | EffectScope) {
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
let activeContext: Context | undefined;

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

function updateComputed(c: ComputedNode): boolean {
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

function updateSignal(s: ValueNode, value: any): boolean {
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

export function isGettable<T>(value: any): value is Gettable<T> {
  return isFunction(value) || isReadable(value);
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
 * Utility type for a value that may be a getter or a plain value.
 * This value can be unwrapped to a plain value with `get` or `untracked` (depending on whether you're in a tracking context and need to track it).
 */
export type MaybeGetter<T> = Getter<T> | T;

/**
 * Any type of value that can be unwrapped by the `get` function.
 */
export type Gettable<T> = Readable<T> | Getter<T> | T;

export type Trackable<T> = Readable<T> | Getter<T>;

export type MaybeReadable<T> = Readable<T> | T;

export type EqualityFn<T> = (previousValue: T, nextValue: T) => boolean;

export interface SignalOptions<T> {
  /**
   * A function to compare the current and next values. Returning `true` means the value has changed.
   */
  equals?: EqualityFn<T>;
}

/* -------------- PUBLIC API --------------- */

export interface Readable<T> {
  /**
   * Returns the current value.
   */
  read(): T;

  /**
   * Returns the current value and tracks this state as a dependency when called within a reactive context (like a `compose` or `$observe` callback).
   */
  track(): T;
}

export interface Writable<T> extends Readable<T> {
  /**
   * Sets the value and returns the updated value.
   */
  write(value: T): T;

  /**
   * Calls `callback` with the current value and sets its result as the new value. Returns the updated value.
   */
  update(callback: (current: T) => T): T;
}

class State<T> implements Writable<T> {
  #node: ValueNode<T>;

  constructor(initialValue: T, options?: SignalOptions<T>) {
    this.#node = {
      previousValue: initialValue as T,
      value: initialValue as T,
      equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
      subs: undefined,
      subsTail: undefined,
      flags: 1 satisfies ReactiveFlags.Mutable,
    };
  }

  read(): T {
    const signal = this.#node;
    const value = signal.value;
    if (signal.flags & (16 satisfies ReactiveFlags.Dirty)) {
      if (updateSignal(signal, value)) {
        const subs = signal.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    }
    return value;
  }

  track(): T {
    warnIfOutsideTrackingScope();
    const value = this.read();
    if (activeSub !== undefined) {
      link(this.#node, activeSub);
    }
    return value;
  }

  write(value: T): T {
    const v = this.#node;
    if (!v.equals(v.value, value)) {
      v.value = value;
      v.flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      const subs = v.subs;
      if (subs !== undefined) {
        propagate(subs);
        if (!batchDepth) {
          flush();
        }
      }
    }
    return value;
  }

  update(fn: (current: T) => T): T {
    const v = this.#node;
    return this.write(fn(v.value));
  }
}

export class Computed<T> implements Readable<T> {
  #node: ComputedNode<T>;

  constructor(callback: (previous?: T) => T, options?: SignalOptions<T>) {
    this.#node = {
      value: undefined,
      holdValue: undefined,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
      getter: function (this: ComputedGetterState<any>) {
        return track(callback(this.value));
      },
      equals: (options?.equals as EqualityFn<unknown>) ?? strictEqual,
    };
  }

  read(): T {
    const node = this.#node;
    const flags = node.flags;
    if (
      flags & (16 satisfies ReactiveFlags.Dirty) ||
      (flags & (32 satisfies ReactiveFlags.Pending) && checkDirty(node.deps!, node))
    ) {
      if (updateComputed(node)) {
        const subs = node.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
      node.flags = flags & ~(32 satisfies ReactiveFlags.Pending);
    }
    return node.value!;
  }

  track(): T {
    const value = this.read();
    warnIfOutsideTrackingScope();
    if (activeSub !== undefined) {
      link(this.#node, activeSub);
    }
    return value;
  }
}

/**
 * Exposes a read-only interface to a Writable.
 */
class WritableReader<T> implements Readable<T> {
  #source: Writable<T>;

  constructor(source: Writable<T>) {
    this.#source = source;
  }

  read(): T {
    return this.#source.read();
  }

  track(): T {
    return this.#source.track();
  }
}

class GetterReader<T> implements Readable<T> {
  #getter: Getter<T>;

  constructor(getter: Getter<T>) {
    this.#getter = getter;
  }

  read(): T {
    return read(this.#getter);
  }

  track(): T {
    warnIfOutsideTrackingScope();
    // Getter may contain trackable signals.
    return this.#getter();
  }
}

class StaticReader<T> implements Readable<T> {
  #value: T;

  constructor(value: T) {
    this.#value = value;
  }

  read(): T {
    return this.#value;
  }

  track(): T {
    warnIfOutsideTrackingScope();
    // Static values don't change, so no tracking actually happens.
    return this.#value;
  }
}

function warnIfOutsideTrackingScope(
  message = ".track() called outside of a tracking scope. You might want to .read() instead.",
) {
  if (getEnv() === "development" && activeSub == undefined) {
    console.trace(message);
  }
}

export function state<T>(value: T, options?: SignalOptions<T>): Writable<T>;
export function state<T>(value: undefined, options: SignalOptions<T>): Writable<T>;
export function state<T>(): Writable<T | undefined>;
export function state<T>(value?: T, options?: SignalOptions<T>): Writable<T> {
  return new State(value as T, options);
}

export function computed<T>(callback: () => T, options?: SignalOptions<T>): Readable<T> {
  // TODO: Warn if getter doesn't track anything.
  // If so you probably used .read() instead of .track()
  return new Computed(callback, options);
}

export function isReadable<T>(value: any): value is Readable<T> {
  return isObject<Readable<T>>(value) && isFunction(value.read) && isFunction(value.track);
}

export function isWritable<T>(value: any): value is Writable<T> {
  return (
    isObject<Writable<T>>(value) &&
    isFunction(value.read) &&
    isFunction(value.track) &&
    isFunction(value.write) &&
    isFunction(value.update)
  );
}

export function toReadable<T>(value: Readable<T> | Getter<T> | T): Readable<T> {
  if (isWritable<T>(value)) {
    return new WritableReader(value);
  } else if (isReadable<T>(value)) {
    return value;
  } else if (isFunction<Getter<T>>(value)) {
    return new GetterReader(value);
  } else {
    return new StaticReader(value);
  }
}

/**
 * Suspends effects during `fn`. Effects for all updated Signal values are called at the end of the batch.
 */
export function batch(fn: () => void): void {
  ++batchDepth;
  fn();
  if (!--batchDepth) flush();
}

export function read<T>(value: Readable<T> | Getter<T> | T): T {
  if (isReadable(value)) {
    return value.read();
  } else if (isFunction(value)) {
    return untracked(() => value());
  } else {
    return value;
  }
}

export function track<T>(value: Readable<T> | Getter<T> | T): T {
  if (isReadable(value)) {
    return value.track();
  } else if (isFunction(value)) {
    return value();
  } else {
    return value;
  }
}

export function untracked<T>(callback: () => T): T {
  let result: T;
  const pausedSub = setCurrentSub(undefined);
  result = callback();
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
export function nextValue<T>(target: Readable<T> | Getter<T>, options?: NextValueOptions<T>): Promise<T> {
  if (!isGettable<T>(target)) {
    throw new Error(`Target must be a Getter function or Readable. Got: ${typeOf(target)}`);
  }

  return new Promise((resolve, reject) => {
    let initial = true;
    const unsubscribe = watch(() => {
      const value = track(target);

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
export type WatchCallback = () => void | (() => void);

export type UnsubscribeFn = () => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to clean up the effect.
 * If you are using an effect inside a View or Store, try the `useEffect` hook instead, which cleans up automatically when the component unmounts.
 */
export function watch(callback: WatchCallback): UnsubscribeFn {
  const e: Effect = {
    fn: callback,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 2 satisfies ReactiveFlags.Watching,
  };
  if (activeSub !== undefined) {
    link(e, activeSub);
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
