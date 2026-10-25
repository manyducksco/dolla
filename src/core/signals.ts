import { isFunction, isThenable } from "../utils.js";
import { reactiveScopeStack, setNodeDebug } from "./signal-debug.js";
import { isSignalError, reportSignalError, toSignalError, type SignalErrorInfo } from "./errors.js";
import type { Context } from "./context.js";

export interface ReactiveNode {
  _deps?: Link;
  _depsTail?: Link;
  _subs?: Link;
  _subsTail?: Link;
  _flags: ReactiveFlags;
}

interface EffectNode extends ReactiveNode {
  _fn(): void | (() => void);
  _cleanup?: () => void;
  _context?: Context;
}

interface ComputedNode<T = any> extends ReactiveNode {
  _value: T | undefined;
  _getter: (previousValue?: T) => MaybeGetter<T>;
  _error?: unknown;
}

interface ValueNode<T = any> extends ReactiveNode {
  _currentValue: T;
  _pendingValue: T;

  /**
   * If true, notify only when value is !== previous.
   */
  _skipEqualValues: boolean;
}

interface Link {
  _version: number;
  _dep: ReactiveNode;
  _sub: ReactiveNode;
  _prevSub: Link | undefined;
  _nextSub: Link | undefined;
  _prevDep: Link | undefined;
  _nextDep: Link | undefined;
}

interface Stack<T> {
  _value: T;
  _prev: Stack<T> | undefined;
}

/*==================================*\
||         Signal Internals         ||
\*==================================*/

const enum ReactiveFlags {
  None = 0,
  Mutable = 1,
  Watching = 2,
  RecursedCheck = 4,
  Recursed = 8,
  Dirty = 16,
  Pending = 32,
}

let cycle = 0;
let batchDepth = 0;
let notifyIndex = 0;
let queuedLength = 0;
let activeSub: ReactiveNode | undefined;

const queued: (EffectNode | undefined)[] = [];

function link(dep: ReactiveNode, sub: ReactiveNode, version: number): void {
  const prevDep = sub._depsTail;
  if (prevDep !== undefined && prevDep._dep === dep) {
    return;
  }
  const nextDep = prevDep !== undefined ? prevDep._nextDep : sub._deps;
  if (nextDep !== undefined && nextDep._dep === dep) {
    nextDep._version = version;
    sub._depsTail = nextDep;
    return;
  }
  const prevSub = dep._subsTail;
  if (prevSub !== undefined && prevSub._version === version && prevSub._sub === sub) {
    return;
  }
  const newLink =
    (sub._depsTail =
    dep._subsTail =
      {
        _version: version,
        _dep: dep,
        _sub: sub,
        _prevDep: prevDep,
        _nextDep: nextDep,
        _prevSub: prevSub,
        _nextSub: undefined,
      });
  if (nextDep !== undefined) {
    nextDep._prevDep = newLink;
  }
  if (prevDep !== undefined) {
    prevDep._nextDep = newLink;
  } else {
    sub._deps = newLink;
  }
  if (prevSub !== undefined) {
    prevSub._nextSub = newLink;
  } else {
    dep._subs = newLink;
  }
}

function unwatched(node: ReactiveNode): void {
  if (!(node._flags & ReactiveFlags.Mutable)) {
    effectCleanup(node);
  } else if (node._depsTail !== undefined) {
    node._depsTail = undefined;
    node._flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    purgeDeps(node);
  }
}

function unlink(link: Link, sub = link._sub): Link | undefined {
  const dep = link._dep;
  const prevDep = link._prevDep;
  const nextDep = link._nextDep;
  const nextSub = link._nextSub;
  const prevSub = link._prevSub;
  if (nextDep !== undefined) {
    nextDep._prevDep = prevDep;
  } else {
    sub._depsTail = prevDep;
  }
  if (prevDep !== undefined) {
    prevDep._nextDep = nextDep;
  } else {
    sub._deps = nextDep;
  }
  if (nextSub !== undefined) {
    nextSub._prevSub = prevSub;
  } else {
    dep._subsTail = prevSub;
  }
  if (prevSub !== undefined) {
    prevSub._nextSub = nextSub;
  } else if ((dep._subs = nextSub) === undefined) {
    unwatched(dep);
  }
  return nextDep;
}

function notify(effect: EffectNode): void {
  let insertIndex = queuedLength;
  let firstInsertedIndex = insertIndex;

  do {
    queued[insertIndex++] = effect;
    effect._flags &= ~ReactiveFlags.Watching;
    effect = effect._subs?._sub as EffectNode;
    if (effect === undefined || !(effect._flags & ReactiveFlags.Watching)) {
      break;
    }
  } while (true);

  queuedLength = insertIndex;

  while (firstInsertedIndex < --insertIndex) {
    const left = queued[firstInsertedIndex];
    queued[firstInsertedIndex++] = queued[insertIndex];
    queued[insertIndex] = left;
  }
}

function update(node: ReactiveNode): boolean {
  if (node._depsTail !== undefined) {
    return updateComputed(node as ComputedNode);
  } else {
    return updateValue(node as ValueNode);
  }
}

function propagate(link: Link): void {
  let next = link._nextSub;
  let stack: Stack<Link | undefined> | undefined;

  top: do {
    const sub = link._sub;
    let flags = sub._flags;

    if (
      !(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed | ReactiveFlags.Dirty | ReactiveFlags.Pending))
    ) {
      sub._flags = flags | ReactiveFlags.Pending;
    } else if (!(flags & (ReactiveFlags.RecursedCheck | ReactiveFlags.Recursed))) {
      flags = ReactiveFlags.None;
    } else if (!(flags & ReactiveFlags.RecursedCheck)) {
      sub._flags = (flags & ~ReactiveFlags.Recursed) | ReactiveFlags.Pending;
    } else if (!(flags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) && isValidLink(link, sub)) {
      sub._flags = flags | (ReactiveFlags.Recursed | ReactiveFlags.Pending);
      flags &= ReactiveFlags.Mutable;
    } else {
      flags = ReactiveFlags.None;
    }

    if (flags & ReactiveFlags.Watching) {
      notify(sub as EffectNode);
    }

    if (flags & ReactiveFlags.Mutable) {
      const subSubs = sub._subs;
      if (subSubs !== undefined) {
        const nextSub = (link = subSubs)._nextSub;
        if (nextSub !== undefined) {
          stack = { _value: next, _prev: stack };
          next = nextSub;
        }
        continue;
      }
    }

    if ((link = next!) !== undefined) {
      next = link._nextSub;
      continue;
    }

    while (stack !== undefined) {
      link = stack._value!;
      stack = stack._prev;
      if (link !== undefined) {
        next = link._nextSub;
        continue top;
      }
    }

    break;
  } while (true);
}

function checkDirty(link: Link, sub: ReactiveNode): boolean {
  let stack: Stack<Link> | undefined;
  let checkDepth = 0;
  let dirty = false;

  top: do {
    const dep = link._dep;
    const flags = dep._flags;

    if (sub._flags & ReactiveFlags.Dirty) {
      dirty = true;
    } else if (
      (flags & (ReactiveFlags.Mutable | ReactiveFlags.Dirty)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Dirty)
    ) {
      if (update(dep)) {
        const subs = dep._subs!;
        if (subs._nextSub !== undefined) {
          shallowPropagate(subs);
        }
        dirty = true;
      }
    } else if (
      (flags & (ReactiveFlags.Mutable | ReactiveFlags.Pending)) ===
      (ReactiveFlags.Mutable | ReactiveFlags.Pending)
    ) {
      if (link._nextSub !== undefined || link._prevSub !== undefined) {
        stack = { _value: link, _prev: stack };
      }
      link = dep._deps!;
      sub = dep;
      ++checkDepth;
      continue;
    }

    if (!dirty) {
      const nextDep = link._nextDep;
      if (nextDep !== undefined) {
        link = nextDep;
        continue;
      }
    }

    while (checkDepth--) {
      const firstSub = sub._subs!;
      const hasMultipleSubs = firstSub._nextSub !== undefined;
      if (hasMultipleSubs) {
        link = stack!._value;
        stack = stack!._prev;
      } else {
        link = firstSub;
      }
      if (dirty) {
        if (update(sub)) {
          if (hasMultipleSubs) {
            shallowPropagate(firstSub);
          }
          sub = link._sub;
          continue;
        }
        dirty = false;
      } else {
        sub._flags &= ~ReactiveFlags.Pending;
      }
      sub = link._sub;
      const nextDep = link._nextDep;
      if (nextDep !== undefined) {
        link = nextDep;
        continue top;
      }
    }

    return dirty;
  } while (true);
}

function shallowPropagate(link: Link): void {
  do {
    const sub = link._sub;
    const flags = sub._flags;
    if ((flags & (ReactiveFlags.Pending | ReactiveFlags.Dirty)) === ReactiveFlags.Pending) {
      sub._flags = flags | ReactiveFlags.Dirty;
      if ((flags & (ReactiveFlags.Watching | ReactiveFlags.RecursedCheck)) === ReactiveFlags.Watching) {
        notify(sub as EffectNode);
      }
    }
  } while ((link = link._nextSub!) !== undefined);
}

function isValidLink(checkLink: Link, sub: ReactiveNode): boolean {
  if (sub._depsTail === checkLink) return true;
  let link = sub._depsTail;
  while (link !== undefined) {
    if (link === checkLink) return true;
    link = link._prevDep;
  }
  return false;
}

function setActiveSub(sub?: ReactiveNode) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

function withReactiveScope<T>(
  node: ReactiveNode,
  prevSub: ReactiveNode | undefined,
  fn: () => T,
  withPurge?: boolean,
): T {
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(node);
  let succeeded = false;
  try {
    const result = fn();
    succeeded = true;
    return result;
  } finally {
    activeSub = prevSub;
    node._flags &= ~ReactiveFlags.RecursedCheck;
    if (withPurge && succeeded) purgeDeps(node);
    reactiveScopeStack.length = scopeLen;
  }
}

function evaluateComputed<T>(c: ComputedNode<T>): boolean {
  const previous = c._value;
  const next = get(c._getter(previous));
  c._value = next;
  c._error = undefined;
  return previous !== next;
}

function updateComputed(c: ComputedNode): boolean {
  ++cycle;
  c._depsTail = undefined;
  c._flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
  const prevSub = setActiveSub(c);
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(c);

  let succeeded = false;
  try {
    const changed = evaluateComputed(c);
    succeeded = true;
    return changed;
  } catch (error) {
    c._error = error;
    throw toSignalError(error, { phase: "computed", node: c });
  } finally {
    activeSub = prevSub;
    c._flags &= ~ReactiveFlags.RecursedCheck;
    if (succeeded) purgeDeps(c);
    reactiveScopeStack.length = scopeLen;
  }
}

function updateValue(v: ValueNode): boolean {
  v._flags = ReactiveFlags.Mutable;
  const didChange = v._currentValue !== (v._currentValue = v._pendingValue);
  return v._skipEqualValues ? didChange : true;
}

function effectErrorInfo(e: EffectNode, phase: "effect" | "effect-cleanup"): SignalErrorInfo {
  return { phase, node: e, context: e._context };
}

function reportAsyncEffect(e: EffectNode, result: PromiseLike<unknown>): void {
  const error = new Error(
    "Effect callbacks must be synchronous. Return a cleanup function instead, or use an AbortController for async work.",
  );

  reportSignalError(
    toSignalError(error, {
      phase: "effect",
      node: e,
      context: e._context,
      triggerFrames: [],
    }),
    e._context,
  );

  // Prevent an unhandled rejection if the async callback fails later.
  Promise.resolve(result).catch((reason) => {
    reportSignalError(toSignalError(reason, effectErrorInfo(e, "effect")), e._context);
  });
}

function run(e: EffectNode): void {
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(e);
  try {
    const flags = e._flags;
    let shouldRun = false;

    try {
      shouldRun = Boolean(flags & ReactiveFlags.Dirty || (flags & ReactiveFlags.Pending && checkDirty(e._deps!, e)));
    } catch (error) {
      // A dependency threw while checking dirtiness. Keep the effect able to
      // retry on the next relevant change instead of leaving it Pending.
      e._flags = ReactiveFlags.Watching;
      throw toSignalError(error, effectErrorInfo(e, "effect"));
    }

    if (shouldRun) {
      ++cycle;
      e._depsTail = undefined;
      e._flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
      const prevSub = setActiveSub(e);
      let bodyFailed = false;

      const cleanup = e._cleanup;
      e._cleanup = undefined;
      if (cleanup) {
        try {
          cleanup();
        } catch (error) {
          reportSignalError(toSignalError(error, effectErrorInfo(e, "effect-cleanup")), e._context);
        }
      }

      try {
        const result = e._fn();
        if (isFunction(result)) {
          e._cleanup = result;
        } else if (isThenable(result)) {
          reportAsyncEffect(e, result);
        }
      } catch (error) {
        bodyFailed = true;
        throw toSignalError(error, effectErrorInfo(e, "effect"));
      } finally {
        activeSub = prevSub;
        e._flags &= ~ReactiveFlags.RecursedCheck;
        // Keep the dependency union after a failure so the effect can retry
        // when any of its previous or newly-read dependencies change.
        if (!bodyFailed) purgeDeps(e);
      }
    } else {
      e._flags = ReactiveFlags.Watching;
    }
  } finally {
    reactiveScopeStack.length = scopeLen;
  }
}

function flush(): void {
  try {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      try {
        run(effect);
      } catch (error) {
        if (isSignalError(error)) {
          reportSignalError(error, effect._context);
        } else {
          throw error;
        }
      }
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      effect._flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed;
    }
    notifyIndex = 0;
    queuedLength = 0;
    queued.length = 0;
  }
}

function purgeDeps(sub: ReactiveNode) {
  const depsTail = sub._depsTail;
  let dep = depsTail !== undefined ? depsTail._nextDep : sub._deps;
  while (dep !== undefined) {
    dep = unlink(dep, sub);
  }
}

/*==================================*\
||        API Implementation        ||
\*==================================*/

function resolveValue<T>(next: SetterAction<T>, current: T): T {
  if (isFunction(next)) {
    const prevSub = setActiveSub(undefined);
    try {
      return (next as (current: T) => T)(current);
    } catch (error) {
      throw toSignalError(error, { phase: "setter" });
    } finally {
      setActiveSub(prevSub);
    }
  }
  return next as T;
}

function computedGetter(node: ComputedNode) {
  const sub = activeSub;

  try {
    const flags = node._flags;
    if (
      flags & ReactiveFlags.Dirty ||
      (flags & ReactiveFlags.Pending &&
        (checkDirty(node._deps!, node) || ((node._flags = flags & ~ReactiveFlags.Pending), false)))
    ) {
      if (updateComputed(node)) {
        const subs = node._subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    } else if (node._error !== undefined) {
      throw toSignalError(node._error, { phase: "computed", node });
    } else if (!node._flags) {
      node._flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
      const prevSub = setActiveSub(node);
      const scopeLen = reactiveScopeStack.length;
      reactiveScopeStack.push(node);

      let succeeded = false;
      try {
        evaluateComputed(node);
        succeeded = true;
      } catch (error) {
        node._error = error;
        throw toSignalError(error, { phase: "computed", node });
      } finally {
        activeSub = prevSub;
        node._flags &= ~ReactiveFlags.RecursedCheck;
        if (succeeded) purgeDeps(node);
        reactiveScopeStack.length = scopeLen;
      }
    }

    return node._value!;
  } finally {
    // Link even when evaluation throws, so a parent effect retries when the
    // computed recovers.
    if (sub !== undefined) {
      link(node, sub, cycle);
    }
  }
}

function computedSetter(node: ComputedNode, next: SetterAction<any>) {
  const value = resolveValue(next, node._value);
  if (node._value !== value) {
    node._value = value;
    node._error = undefined;

    node._flags &= ~(ReactiveFlags.Dirty | ReactiveFlags.Pending);

    let link = node._subs;
    while (link !== undefined) {
      const sub = link._sub;
      const subFlags = sub._flags;

      if ((subFlags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) === 0) {
        sub._flags = subFlags | ReactiveFlags.Dirty;
        notify(sub as EffectNode);
      }

      link = link._nextSub;
    }

    if (!batchDepth) {
      flush();
    }
  }
  return value;
}

function valueGetter<T>(node: ValueNode<T>): T {
  if (node._flags & ReactiveFlags.Dirty) {
    if (updateValue(node)) {
      const subs = node._subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  }
  let sub = activeSub;
  while (sub !== undefined) {
    if (sub._flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
      link(node, sub, cycle);
      break;
    }
    sub = sub._subs?._sub;
  }
  return node._currentValue;
}

function valueSetter<T>(node: ValueNode<T>, next: SetterAction<T>): T {
  const value = resolveValue(next, node._pendingValue);
  if (node._pendingValue !== (node._pendingValue = value)) {
    node._flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    const subs = node._subs;
    if (subs !== undefined) {
      propagate(subs);
      if (!batchDepth) {
        flush();
      }
    }
  }
  return value;
}

function effectCleanup(node: ReactiveNode): void {
  node._depsTail = undefined;
  node._flags = ReactiveFlags.None;
  purgeDeps(node);
  const sub = node._subs;
  if (sub !== undefined) {
    unlink(sub);
  }

  const effect = node as EffectNode;
  const cleanup = effect._cleanup;
  effect._cleanup = undefined;
  if (!cleanup) return;

  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(node);
  try {
    cleanup();
  } catch (error) {
    reportSignalError(toSignalError(error, effectErrorInfo(effect, "effect-cleanup")), effect._context);
  } finally {
    reactiveScopeStack.length = scopeLen;
  }
}

/*==================================*\
||            Public API            ||
\*==================================*/

/**
 * Returns the currently held value. Registers the state as a dependency when called within a tracking context.
 */
export type Getter<T> = () => T;

/**
 * A value that may be a static value or a getter function.
 * Can be converted to a plain value with `get`.
 */
export type MaybeGetter<T> = Getter<T> | T;

/**
 * Updates the value of an atom. Takes a new plain value, or an update function to compute one.
 */
export type Setter<T> = (next: SetterAction<T>) => T;
export type SetterAction<T> = T | ((prev: T) => T);

/**
 * A getter and setter pair, as returned from `createAtom`.
 */
export type AtomAccessors<T> = [Getter<T>, Setter<T>];

/**
 * Creates a new atom with a default `undefined` value.
 * Returns a `[getter, setter]` function tuple.
 *
 * @example
 * const [getValue, setValue] = createAtom();
 */
export function createAtom<T>(): AtomAccessors<T | undefined>;

/**
 * Creates a new atom with a value computed from an existing getter.
 * This is usually used to create a 'settable' getter, in which you can store
 * a temporary value until it gets overwritten by a _real_ update.
 *
 * @example
 * const [getValue, setValue] = createAtom("");
 * const [getInputValue, setInputValue] = createAtom(getValue);
 *
 * setInputValue("temporary");
 * getValue("");
 * getInputValue(); // "temporary"
 *
 * setValue("overwritten");
 * getValue("overwritten");
 * getInputValue(); // "overwritten"
 */
export function createAtom<T>(initialValue: Getter<T>, options?: { name?: string }): AtomAccessors<T>;

/**
 * Creates a new atom with a value computed from an existing getter.
 * This is usually used to create a 'settable' getter, in which you can store
 * a temporary value until it gets overwritten by a _real_ update.
 *
 * @example
 * const [getValue, setValue] = createAtom("");
 * const [getInputValue, setInputValue] = createAtom(getValue);
 *
 * setInputValue("temporary");
 * getValue("");
 * getInputValue(); // "temporary"
 *
 * setValue("overwritten");
 * getValue("overwritten");
 * getInputValue(); // "overwritten"
 */
export function createAtom<T>(initialValue: MaybeGetter<T>, options?: { name?: string }): AtomAccessors<T>;

/**
 * Creates a new atom with an initial value.
 * Returns a `[getter, setter]` function tuple.
 *
 * @example
 * const [getCount, setCount] = createAtom(5);
 */
export function createAtom<T>(initialValue: T, options?: { name?: string }): AtomAccessors<T>;

export function createAtom<T>(value?: T, options?: { name?: string }) {
  if (isFunction<Getter<T>>(value)) {
    const node: ComputedNode<T> = {
      _value: undefined,
      _subs: undefined,
      _subsTail: undefined,
      _deps: undefined,
      _depsTail: undefined,
      _flags: ReactiveFlags.None,
      _getter: value as (previousValue?: T | undefined) => T,
    };
    setNodeDebug(node, "composed", value, options?.name);
    return [() => computedGetter(node), (next: T) => computedSetter(node, next)];
  } else {
    const node: ValueNode<T> = {
      _currentValue: value as T,
      _pendingValue: value as T,
      _subs: undefined,
      _subsTail: undefined,
      _flags: ReactiveFlags.Mutable,
      _skipEqualValues: true,
    };
    return [() => valueGetter(node), (next: T) => valueSetter(node, next)];
  }
}

/**
 * Creates a custom setter for an existing getter.
 * The callback receives the current value and should return the new value.
 */
export function createSetter<T>(getter: Getter<T>, callback: (current: T) => T | void): Setter<T> {
  return (value: SetterAction<T>) => {
    const next = typeof value === "function" ? (value as (current: T) => T)(peek(getter)) : value;
    const returned = callback(next);
    return returned ?? next;
  };
}

/**
 * Creates a derived/computed signal from a function that tracks dependencies.
 * Returns a lazy getter that only recomputes when a dependency changes.
 * The callback may return a value or a getter; returned getters are read with
 * `get`, so they are unwrapped and tracked.
 * Also accepts a plain value to create a constant getter (reverse `get`).
 */
export function compose<T>(
  getter: T | ((previousValue?: T) => MaybeGetter<T>),
  options?: { name?: string },
): Getter<T> {
  if (!isFunction(getter)) {
    // Creates a getter out of a plain value; reverse `get`.
    return () => getter as T;
  }
  const node: ComputedNode = {
    _value: undefined,
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.None,
    _getter: getter,
  };
  setNodeDebug(node, "composed", getter, options?.name);
  return () => computedGetter(node);
}

/**
 * Creates an effect with auto-tracking for getters called within its callback.
 */
export function createEffect(fn: () => void, options?: { name?: string; context?: Context }): () => void {
  const e: EffectNode = {
    _fn: fn,
    _cleanup: undefined,
    _context: options?.context,
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
  };
  setNodeDebug(e, "effect", fn, options?.name);
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
  }

  try {
    withReactiveScope(e, prevSub, () => {
      try {
        const result = e._fn();
        if (isFunction(result)) {
          e._cleanup = result;
        } else if (isThenable(result)) {
          reportAsyncEffect(e, result);
        }
      } catch (error) {
        throw toSignalError(error, effectErrorInfo(e, "effect"));
      }
    });
  } catch (error) {
    const signalError = toSignalError(error, effectErrorInfo(e, "effect"));
    effectCleanup(e);
    reportSignalError(signalError, e._context);
    return () => {};
  }

  return () => effectCleanup(e);
}

/**
 * Returns the value of a MaybeGetter<T>.
 * Tracks the value if it is a getter; returns the value verbatim if it's not.
 * Use the non-tracking `peek` to get the value without tracking.
 */
export function get<T>(value: T | Getter<T>): T {
  if (isFunction<Getter<T>>(value)) {
    return value();
  } else {
    return value;
  }
}

/**
 * Unwraps a `MaybeGetter<T>` into a plain `T`.
 * Tracks the value if it is a getter.
 * Use the non-tracking `peek` if you're being stealthy.
 *
 * @deprecated Use `get` instead.
 */
export const unwrap: typeof get = get;

/**
 * Unwraps a `MaybeGetter<T>` into a plain `T`. Will _not_ track if the value is a getter.
 */
export function peek<T>(value: T | Getter<T>): T {
  const prevSub = setActiveSub(undefined);
  try {
    return get(value);
  } catch (error) {
    throw toSignalError(error, { phase: "computed" });
  } finally {
    setActiveSub(prevSub);
  }
}

/**
 * Groups several signal changes into a single transaction.
 * Suspends effects until `callback` finishes, then runs all updates at once.
 */
export function batch(callback: () => void): void {
  ++batchDepth;

  let callbackError: unknown;
  let callbackFailed = false;
  try {
    callback();
  } catch (error) {
    callbackError = error;
    callbackFailed = true;
  }

  if (!--batchDepth) {
    try {
      flush();
    } catch (error) {
      if (callbackFailed) {
        throw new AggregateError([callbackError, error], "batch callback and flush both failed");
      }
      throw error;
    }
  }

  if (callbackFailed) throw callbackError;
}

/**
 * Subscribes to a getter and runs the callback whenever its value changes.
 * Returns an unsubscribe function.
 */
export function subscribe<T>(
  target: Getter<T>,
  fn: (value: T) => any,
  options?: { name?: string; context?: Context },
): () => void {
  return createEffect(() => {
    // Track the value.
    const value = target();

    // Run callback outside of tracking context to avoid tracking inner signals.
    const prevSub = setActiveSub(undefined);
    try {
      return fn(value);
    } finally {
      setActiveSub(prevSub);
    }
  }, options);
}
