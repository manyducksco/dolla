import type { ReactiveFlags, ReactiveNode } from "alien-signals";
import { createReactiveSystem } from "alien-signals/system";
import { isFunction } from "../utils.js";
import { getActiveContext, type Context } from "./context.js";

const enum EffectFlags {
  Queued = 1 << 6,
}

interface Effect extends ReactiveNode {
  fn(): void | (() => void);
  cleanups?: (() => void)[];
  context?: Context;
}

interface ComputedNode<T = any> extends ReactiveNode {
  value: T | undefined;
  getter: (previous?: T) => T;
  cleanups?: (() => void)[];
}

interface ValueNode<T = any> extends ReactiveNode {
  value: T;
  previousValue: T;
}

const queuedEffects: (Effect | undefined)[] = [];
const { link, unlink, propagate, checkDirty, endTracking, startTracking, shallowPropagate } = createReactiveSystem({
  update(signal: ValueNode | ComputedNode): boolean {
    if ("getter" in signal) {
      return updateComputed(signal);
    } else {
      return updateSignal(signal, signal.value);
    }
  },
  notify,
  unwatched(node: ValueNode | ComputedNode | Effect) {
    if ("getter" in node) {
      let toRemove = node.deps;
      if (toRemove !== undefined) {
        node.flags = 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty;
        do {
          toRemove = unlink(toRemove, node);
        } while (toRemove !== undefined);
      }
    } else if (!("previousValue" in node)) {
      _effectCleanup.call(node);
    }
  },
});

let batchDepth = 0;

let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: ReactiveNode | undefined;

const suspendedEffects = new Set<Effect>();

export function resumeEffects(context: Context) {
  for (const effect of suspendedEffects) {
    if (effect.context === context) {
      suspendedEffects.delete(effect);
      notify(effect);
    }
  }
  flush();
}

function setActiveSub(sub: ReactiveNode | undefined) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

export function untrack<T>(callback: () => T): T {
  const pausedSub = setActiveSub(undefined);
  try {
    return callback();
  } finally {
    setActiveSub(pausedSub);
  }
}

function updateComputed(c: ComputedNode): boolean {
  const prevSub = setActiveSub(c);
  startTracking(c);
  try {
    if ("cleanups" in c && c.cleanups !== undefined) {
      untrack(() => {
        for (let i = 0; i < c.cleanups!.length; i++) {
          c.cleanups![i]();
        }
      });
      c.cleanups = undefined;
    }
    const oldValue = c.value;
    return oldValue !== (c.value = c.getter(oldValue));
  } finally {
    setActiveSub(prevSub);
    endTracking(c);
  }
}

function updateSignal(s: ValueNode, value: any): boolean {
  s.flags = 1 satisfies ReactiveFlags.Mutable;
  return s.previousValue !== (s.previousValue = value);
}

function notify(e: Effect) {
  const flags = e.flags;
  if (!(flags & EffectFlags.Queued)) {
    e.flags = flags | EffectFlags.Queued;
    const subs = e.subs;
    if (subs !== undefined) {
      notify(subs.sub as Effect);
    } else {
      queuedEffects[queuedEffectsLength++] = e;
    }
  }
}

function run(e: Effect, flags: ReactiveFlags): void {
  if (
    flags & (16 satisfies ReactiveFlags.Dirty) ||
    (flags & (32 satisfies ReactiveFlags.Pending) && checkDirty(e.deps!, e))
  ) {
    const prev = setActiveSub(e);
    startTracking(e);
    try {
      if ("cleanups" in e && e.cleanups !== undefined) {
        untrack(() => {
          for (let i = 0; i < e.cleanups!.length; i++) e.cleanups![i]();
        });
        e.cleanups = undefined;
      }

      const result = (e as Effect).fn();

      if (isFunction(result)) {
        if (e.cleanups === undefined) e.cleanups = [result];
        else e.cleanups.push(result);
      }
    } finally {
      setActiveSub(prev);
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
      run(dep as unknown as Effect, (dep.flags = depFlags & ~EffectFlags.Queued));
    }
    link = link.nextDep;
  }
}

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const effect = queuedEffects[notifyIndex]!;
    queuedEffects[notifyIndex++] = undefined;

    if (effect.context?.isSuspended) {
      suspendedEffects.add(effect);
      effect.flags &= ~EffectFlags.Queued; // clear the queued flag so effects can be resumed
      continue;
    }

    run(effect, (effect.flags &= ~EffectFlags.Queued));
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

function _valueGetter(this: ValueNode) {
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

function _valueSetter<T>(this: ValueNode, next: SetterAction<T>): T {
  let value: T;
  if (isFunction<(current: T) => T>(next)) {
    if (isAccessor(next)) {
      value = peek(next); // Take value from accessor
    } else {
      value = next(this.value);
    }
  } else {
    value = next;
  }
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

function _valueAccessor<T>(this: ValueNode, ...next: [SetterAction<T>]) {
  if (next.length) {
    return _valueSetter.call(this, next[0]);
  } else {
    return _valueGetter.call(this);
  }
}

function _computedGetter(this: ComputedNode) {
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

function _computedSetter<T>(this: ComputedNode, next: SetterAction<T>): T {
  let value: T;
  if (isFunction<(current: T | undefined) => T>(next)) {
    if (isAccessor(next)) {
      value = peek(next); // Take value from accessor
    } else {
      value = next(this.value);
    }
  } else {
    value = next as T;
  }

  if (this.value !== value) {
    this.value = value;

    // Clear Dirty and Pending so _memoGetter skips updateComputed
    this.flags &= ~(16 | 32);

    // Manually push the Dirty flag to all subscribers
    let link = this.subs;
    while (link !== undefined) {
      const sub = link.sub;
      const subFlags = sub.flags;

      // Only modify and notify if it isn't already queued for an update
      if ((subFlags & (16 | 32)) === 0) {
        // Force the node to be Dirty so it bypasses checkDirty() upon flush
        sub.flags = subFlags | 16;
        notify(sub as Effect);
      }

      link = link.nextSub;
    }

    // 3. Trigger queued effects
    if (!batchDepth) {
      flush();
    }
  }
  return value;
}

function _computedAccessor<T>(this: ComputedNode, ...next: [SetterAction<T>]) {
  if (next.length) {
    return _computedSetter.call(this, next[0]);
  } else {
    return _computedGetter.call(this);
  }
}

function _effectCleanup(this: Effect): void {
  if (suspendedEffects.has(this)) {
    suspendedEffects.delete(this);
  }

  let dep = this.deps;
  while (dep !== undefined) {
    dep = unlink(dep, this);
  }
  const sub = this.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
  this.flags = 0 satisfies ReactiveFlags.None;

  if ("cleanups" in this && this.cleanups !== undefined) {
    untrack(() => {
      for (let i = 0; i < this.cleanups!.length; i++) {
        this.cleanups![i]();
      }
    });
    this.cleanups = undefined;
  }
}

function isAccessor<T = any>(value: unknown): value is Accessor<T> {
  if (typeof value !== "function") return false;
  return value.name === "bound " + _valueAccessor.name || value.name === "bound " + _computedAccessor.name;
}

/*===================================*\
||                API                ||
\*===================================*/

/**
 * A function that returns the current value of a signal.
 * Automatically tracked as a dependency when called within a tracking scope (such as `memo` or `effect` functions).
 */
export interface Getter<T> {
  /**
   * Returns the latest value.
   */
  (): T;
}

/**
 * A value passed to a setter. Can be a plain value, or an update function.
 */
type SetterAction<T> = T | ((current: T) => T);

export interface Setter<T> {
  /**
   * Updates the stored value. Can be a plain value or an update function.
   */
  (next: SetterAction<T>): T;
}

/**
 * One hybrid getter-setter that returns the latest value when called with no arguments, and sets the value when called with one argument.
 *
 * @example
 * const count = accessor(123);
 *
 * count(); // returns 123
 * count(500); // sets the value
 * count(current => current + 1); // increments the value via update function
 */
export interface Accessor<T> extends Getter<T>, Setter<T> {}

/**
 * Utility type for a value that may be a getter or a plain value.
 * This value can be unwrapped to a plain value with `get` or `untracked` (depending on whether you're in a tracking context and need to track it).
 */
export type MaybeGetter<T> = Getter<T> | T;

/* -------------- PUBLIC API --------------- */

export function state<T>(value: Getter<T>): [Getter<T>, Setter<T>];
export function state<T>(value: T): [Getter<T>, Setter<T>];
export function state<T>(): [Getter<T | undefined>, Setter<T | undefined>];
export function state<T>(value?: MaybeGetter<T>) {
  if (isFunction<Getter<T>>(value)) {
    // Return mutable memo.
    const node: ComputedNode = {
      value: undefined,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
      getter: () => value(),
    };
    return [_computedGetter.bind(node), _computedSetter.bind(node)];
  }

  const node: ValueNode = {
    previousValue: value,
    value: value,
    subs: undefined,
    subsTail: undefined,
    flags: 1 satisfies ReactiveFlags.Mutable,
  };
  return [_valueGetter.bind(node), _valueSetter.bind(node)];
}

/**
 * Memoizes a getter, so it will only be called if its dependencies have changed since it was last called.
 */
export function memo<T>(getter: (previous?: T) => T): Getter<T> {
  return _computedGetter.bind({
    value: undefined,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
    getter,
  });
}

/**
 * Function to be invoked for the effect. Can return an optional cleanup function to be called between invocations.
 */
export type EffectCallback = () => void | (() => void);

export type UnsubscribeFn = () => void;

export type EffectOptions = {
  context?: Context;
};

/**
 * Creates a tracked scope that re-runs whenever the values of any tracked reactives changes.
 * Reactives are tracked by accessing their `value` within the body of the function.
 *
 * NOTE: You must call the unsubscribe function to clean up the effect.
 * If you are using an effect inside a View or Store, try the `useEffect` hook instead, which cleans up automatically when the component unmounts.
 */
export function effect(callback: EffectCallback, options: EffectOptions = {}): UnsubscribeFn {
  const e: Effect = {
    fn: callback,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: 2 satisfies ReactiveFlags.Watching,
    context: options.context ?? getActiveContext(),
  };

  const unsubscribe = _effectCleanup.bind(e);

  const init = () => {
    if (activeSub !== undefined) {
      link(e, activeSub);
    }
    const prev = setActiveSub(e);
    try {
      const result = e.fn();
      if (isFunction(result)) {
        if (e.cleanups === undefined) e.cleanups = [result];
        else e.cleanups.push(result);
      }
    } finally {
      setActiveSub(prev);
    }

    e.context?.onUnmount(unsubscribe);
  };

  if (e.context) {
    if (e.context.isMounted) {
      init();
    } else {
      e.context.onMount(init);
    }
  } else {
    init();
  }

  return unsubscribe;
}

/**
 * Provides a cleanup function that will be called each time the current effect or computed value is updated.
 *
 * @example
 * effect(() => {
 *   something();
 *
 *   cleanup(() => {
 *     // TODO
 *   });
 * });
 */
export function cleanup(fn: () => void) {
  if (activeSub !== undefined) {
    const sub = activeSub as Effect | ComputedNode;
    if (sub.cleanups === undefined) {
      sub.cleanups = [fn];
    } else {
      sub.cleanups.push(fn);
    }
  }
}

/**
 * Creates a getter of the value passed in.
 */
export function getter<T>(value: Getter<T> | T): Getter<T> {
  return () => get(value);
}

export function signal<T>(value: Getter<T>): Accessor<T>;
export function signal<T>(value: T): Accessor<T>;
export function signal<T>(): Accessor<T | undefined>;
export function signal<T>(value?: MaybeGetter<T>) {
  if (isFunction<Getter<T>>(value)) {
    return _computedAccessor.bind({
      value: undefined,
      subs: undefined,
      subsTail: undefined,
      deps: undefined,
      depsTail: undefined,
      flags: 17 as ReactiveFlags.Mutable | ReactiveFlags.Dirty,
      getter,
    });
  } else {
    return _valueAccessor.bind({
      previousValue: value,
      value: value,
      subs: undefined,
      subsTail: undefined,
      flags: 1 satisfies ReactiveFlags.Mutable,
    });
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

export function get<T>(value: MaybeGetter<T>): T {
  if (isFunction(value)) {
    return value();
  } else {
    return value;
  }
}

export function subscribe<T>(target: Getter<T>, callback: (value: T) => void) {
  return effect(() => {
    const value = target();
    untrack(() => callback(value));
  });
}
