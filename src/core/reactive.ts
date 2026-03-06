import type { ReactiveFlags, ReactiveNode } from "alien-signals";
import { createReactiveSystem } from "alien-signals/system";
import { isFunction } from "../typeChecking";

const enum EffectFlags {
  Queued = 1 << 6,
}

interface EffectScope extends ReactiveNode {}

interface Effect extends ReactiveNode {
  fn(): void | (() => void);
  cleanup?: () => void;
}

interface ComputedNode<T = any> extends ReactiveNode {
  value: T | undefined;

  getter: (previous?: T) => T;

  // Temp value set when a computed signal has a value passed to it.
  // This value is held until the real value recomputes.
  holdValue: T | undefined;
}

interface ValueNode<T = any> extends ReactiveNode {
  value: T;
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

function setCurrentSub(sub: ReactiveNode | undefined) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

function updateComputed(c: ComputedNode): boolean {
  const prevSub = setCurrentSub(c);
  startTracking(c);
  try {
    const oldValue = c.value;
    return oldValue !== (c.value = c.getter(oldValue));
  } finally {
    setCurrentSub(prevSub);
    endTracking(c);
  }
}

function updateSignal(s: ValueNode, value: any): boolean {
  s.flags = 1 satisfies ReactiveFlags.Mutable;
  return s.previousValue !== (s.previousValue = value);
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

function _stateGetter(this: ValueNode) {
  if (this.flags & (16 satisfies ReactiveFlags.Dirty)) {
    if (updateSignal(this, this.value)) {
      if (this.subs !== undefined) {
        shallowPropagate(this.subs);
      }
    }
  }
  if (activeSub !== undefined) {
    link(this, activeSub);
  }
  return this.value;
}

function _stateSetter<T>(this: ValueNode, next: T | ((current: T) => T)) {
  let value: T;
  if (isFunction<(current: T) => T>(next)) value = next(this.value);
  else value = next;
  if (this.value !== value) {
    this.value = value;
    this.flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    if (this.subs !== undefined) {
      propagate(this.subs);
      if (!batchDepth) {
        flush();
      }
    }
  }
  return value;
}

function _memoGetter(this: ComputedNode) {
  const flags = this.flags;
  if (
    flags & (16 satisfies ReactiveFlags.Dirty) ||
    (flags & (32 satisfies ReactiveFlags.Pending) && checkDirty(this.deps!, this))
  ) {
    if (updateComputed(this)) {
      if (this.subs !== undefined) {
        shallowPropagate(this.subs);
      }
    }
  } else if (flags & (32 satisfies ReactiveFlags.Pending)) {
    this.flags = flags & ~(32 satisfies ReactiveFlags.Pending);
  }
  if (activeSub !== undefined) {
    link(this, activeSub);
  }
  return this.value!;
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

/**
 * A function that returns the current value of a signal.
 * Automatically tracked as a dependency when called within a tracking scope (such as `memo` or `effect` functions).
 */
export interface Getter<T> {
  (): T;
}

export interface Setter<T> {
  (value: T | ((current: T) => T)): T;
}

/**
 * Utility type for a value that may be a getter or a plain value.
 * This value can be unwrapped to a plain value with `get` or `untracked` (depending on whether you're in a tracking context and need to track it).
 */
export type MaybeGetter<T> = Getter<T> | T;

/* -------------- PUBLIC API --------------- */

export function state<T>(value: T): [Getter<T>, Setter<T>];
export function state<T>(value: undefined): [Getter<T>, Setter<T>];
export function state<T>(): [Getter<T | undefined>, Setter<T | undefined>];
export function state<T>(value?: T) {
  const node: ValueNode = {
    previousValue: value,
    value: value,
    subs: undefined,
    subsTail: undefined,
    flags: 1 satisfies ReactiveFlags.Mutable,
  };
  return [_stateGetter.bind(node), _stateSetter.bind(node)];
}

/**
 * Memoizes a getter, so it will only be called if its dependencies have changed since it was last called.
 */
export function memo<T>(getter: (prev?: T) => T): Getter<T> {
  const node: ComputedNode = {
    value: undefined,
    holdValue: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
    getter,
  };
  return _memoGetter.bind(node);
}

/**
 * Function to be invoked for the effect. Can return an optional cleanup function to be called between invocations.
 */
export type EffectCallback = () => void | (() => void);

export type UnsubscribeFn = () => void;

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to clean up the effect.
 * If you are using an effect inside a View or Store, try the `useEffect` hook instead, which cleans up automatically when the component unmounts.
 */
export function effect(callback: EffectCallback): UnsubscribeFn {
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

/**
 * Creates a getter of the value passed in. If the value is already a function it is returned untouched.
 */
export function getter<T>(value: Getter<T> | T): Getter<T> {
  if (isFunction<Getter<T>>(value)) {
    return value;
  } else {
    return () => value;
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

/**
 * Calls a function in an untracked scope and returns its value.
 */
export function peek<T>(value: MaybeGetter<T>): T {
  if (isFunction(value)) {
    return untrack(value);
  } else {
    return value;
  }
}

export function track<T>(value: MaybeGetter<T>): T {
  if (isFunction(value)) {
    return value();
  } else {
    return value;
  }
}

function untrack<T>(callback: () => T): T {
  const pausedSub = setCurrentSub(undefined);
  try {
    return callback();
  } finally {
    setCurrentSub(pausedSub);
  }
}

export function subscribe<T>(target: Getter<T>, callback: (value: T) => void) {
  return effect(() => {
    const value = target();
    untrack(() => callback(value));
  });
}
