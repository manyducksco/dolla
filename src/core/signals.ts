import { isFunction } from "../utils.js";
import { Context, onCleanup } from "./index.js";

interface ReactiveNode {
  _deps?: Link;
  _depsTail?: Link;
  _subs?: Link;
  _subsTail?: Link;
  _flags: ReactiveFlags;
}

interface EffectNode extends ReactiveNode {
  _fn(): void | (() => void);
  _cleanup?: () => void;
}

interface ComputedNode<T = any> extends ReactiveNode {
  _value: T | undefined;
  _getter: (previousValue?: T) => T;
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
    effectCleanup.call(node);
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
  let link = sub._depsTail;
  while (link !== undefined) {
    if (link === checkLink) {
      return true;
    }
    link = link._prevDep;
  }
  return false;
}

function setActiveSub(sub?: ReactiveNode) {
  const prevSub = activeSub;
  activeSub = sub;
  return prevSub;
}

function updateComputed(c: ComputedNode): boolean {
  ++cycle;
  c._depsTail = undefined;
  c._flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
  const prevSub = setActiveSub(c);
  try {
    const oldValue = c._value;
    return oldValue !== (c._value = c._getter(oldValue));
  } finally {
    activeSub = prevSub;
    c._flags &= ~ReactiveFlags.RecursedCheck;
    purgeDeps(c);
  }
}

function updateValue(v: ValueNode): boolean {
  v._flags = ReactiveFlags.Mutable;
  const didChange = v._currentValue !== (v._currentValue = v._pendingValue);
  return v._skipEqualValues ? didChange : true;
}

function run(e: EffectNode): void {
  const flags = e._flags;
  if (flags & ReactiveFlags.Dirty || (flags & ReactiveFlags.Pending && checkDirty(e._deps!, e))) {
    ++cycle;
    e._depsTail = undefined;
    e._flags = ReactiveFlags.Watching | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(e);
    try {
      e._cleanup?.();
      e._cleanup = undefined;
      const result = e._fn();
      if (isFunction(result)) e._cleanup = result;
    } finally {
      activeSub = prevSub;
      e._flags &= ~ReactiveFlags.RecursedCheck;
      purgeDeps(e);
    }
  } else {
    e._flags = ReactiveFlags.Watching;
  }
}

function flush(): void {
  try {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      run(effect);
    }
  } finally {
    while (notifyIndex < queuedLength) {
      const effect = queued[notifyIndex]!;
      queued[notifyIndex++] = undefined;
      effect._flags |= ReactiveFlags.Watching | ReactiveFlags.Recursed;
    }
    notifyIndex = 0;
    queuedLength = 0;
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
  if (isFunction(next)) return peek(() => next(current)) as T;
  return next as T;
}

function computedGetter(this: ComputedNode) {
  const flags = this._flags;
  if (
    flags & ReactiveFlags.Dirty ||
    (flags & ReactiveFlags.Pending &&
      (checkDirty(this._deps!, this) || ((this._flags = flags & ~ReactiveFlags.Pending), false)))
  ) {
    if (updateComputed(this)) {
      const subs = this._subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (!flags) {
    this._flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(this);
    try {
      this._value = unwrap(this._getter());
    } finally {
      activeSub = prevSub;
      this._flags &= ~ReactiveFlags.RecursedCheck;
    }
  }
  const sub = activeSub;
  if (sub !== undefined) {
    link(this, sub, cycle);
  }
  return this._value!;
}

function computedSetter(this: ComputedNode, next: SetterAction<any>) {
  const value = resolveValue(next, this._value);
  if (this._value !== value) {
    this._value = value;

    // Clear Dirty and Pending so _computedGetter skips updateComputed
    this._flags &= ~(ReactiveFlags.Dirty | ReactiveFlags.Pending);

    // Manually push the Dirty flag to all subscribers
    let link = this._subs;
    while (link !== undefined) {
      const sub = link._sub;
      const subFlags = sub._flags;

      // Only modify and notify if it isn't already queued for an update
      if ((subFlags & (ReactiveFlags.Dirty | ReactiveFlags.Pending)) === 0) {
        // Force the node to be Dirty so it bypasses checkDirty() upon flush
        sub._flags = subFlags | ReactiveFlags.Dirty;
        notify(sub as EffectNode);
      }

      link = link._nextSub;
    }

    // Trigger queued effects
    if (!batchDepth) {
      flush();
    }
  }
  return value;
}

function valueGetter<T>(this: ValueNode<T>): T {
  if (this._flags & ReactiveFlags.Dirty) {
    if (updateValue(this)) {
      const subs = this._subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  }
  let sub = activeSub;
  while (sub !== undefined) {
    if (sub._flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) {
      link(this, sub, cycle);
      break;
    }
    sub = sub._subs?._sub;
  }
  return this._currentValue;
}

function valueSetter<T>(this: ValueNode<T>, next: SetterAction<T>): T {
  const value = resolveValue(next, this._pendingValue);
  if (this._pendingValue !== (this._pendingValue = value)) {
    this._flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
    const subs = this._subs;
    if (subs !== undefined) {
      propagate(subs);
      if (!batchDepth) {
        flush();
      }
    }
  }
  return value;
}

function customSetter<T>(this: Getter<T>, callback: (current: T) => T | void, value: SetterAction<T>): T {
  const next = typeof value === "function" ? (value as (current: T) => T)(peek(this)) : value;
  const returned = callback(next);
  return returned ?? next;
}

function effectCleanup(this: ReactiveNode): void {
  this._depsTail = undefined;
  this._flags = ReactiveFlags.None;
  purgeDeps(this);
  const sub = this._subs;
  if (sub !== undefined) {
    unlink(sub);
  }
  (this as EffectNode)._cleanup?.();
  (this as EffectNode)._cleanup = undefined;
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
 * Can be converted to a plain value with `unwrap`.
 */
export type MaybeGetter<T> = T | Getter<T>;

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
export function createAtom<T>(initialValue: Getter<T>): AtomAccessors<T>;

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
export function createAtom<T>(initialValue: MaybeGetter<T>): AtomAccessors<T>;

/**
 * Creates a new atom with an initial value.
 * Returns a `[getter, setter]` function tuple.
 *
 * @example
 * const [getCount, setCount] = createAtom(5);
 */
export function createAtom<T>(initialValue: T): AtomAccessors<T>;

export function createAtom<T>(value?: T) {
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
    return [computedGetter.bind(node), computedSetter.bind(node)];
  } else {
    const node: ValueNode<T> = {
      _currentValue: value as T,
      _pendingValue: value as T,
      _subs: undefined,
      _subsTail: undefined,
      _flags: ReactiveFlags.Mutable,
      _skipEqualValues: true,
    };
    return [valueGetter.bind(node), valueSetter.bind(node)];
  }
}

/**
 * Creates a customsetter with a `getter` as its source.
 */
export function createSetter<T>(getter: Getter<T>, callback: (current: T) => T | void): Setter<T> {
  return customSetter.bind(getter, callback as any) as Setter<T>;
}

export function compose<T>(getter: T | ((previousValue?: T) => Getter<T> | T)): Getter<T> {
  if (!isFunction(getter)) {
    // Creates a getter out of a plain value; reverse unwrap.
    return () => getter as T;
  }
  return computedGetter.bind({
    _value: undefined,
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.None,
    _getter: getter,
  });
}

function _depsGetter(this: MaybeGetter<any>[], fn: (...values: any[]) => void) {
  // Trigger getters for all deps.
  const values = this.map((dep) => unwrap(dep));
  // Ignore tracking in original getter.
  return peek(() => fn(...values));
}

export type Unwrapped<T> = {
  [K in keyof T]: T[K] extends () => infer R ? R : T[K];
};

/**
 * Creates an effect with auto-tracking for getters called within its callback.
 */
export function createEffect(fn: () => void): () => void;

/**
 * Creates an effect that tracks getters in its `deps` array.
 * Unwrapped values from `deps` are passed as arguments to the callback.
 */
export function createEffect<const T extends readonly any[]>(
  fn: (...values: Unwrapped<T>) => void,
  deps?: T,
): () => void;

export function createEffect(fn: (...values: any[]) => void, deps?: any[]): () => void {
  const e: EffectNode = {
    _fn: deps ? _depsGetter.bind(deps, fn) : fn,
    _cleanup: undefined,
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
  };
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
  }
  try {
    const result = e._fn();
    if (isFunction(result)) e._cleanup = result;
  } finally {
    activeSub = prevSub;
    e._flags &= ~ReactiveFlags.RecursedCheck;
  }
  return effectCleanup.bind(e);
}

/**
 * Unwraps a `MaybeGetter<T>` into a plain `T`.
 * Tracks the value if it is a getter.
 * Use the non-tracking `peek` if you're being stealthy.
 */
export function unwrap<T>(value: T | Getter<T>): T {
  if (isFunction<Getter<T>>(value)) {
    return value();
  } else {
    return value;
  }
}

/**
 * Unwraps a `MaybeGetter<T>` into a plain `T`. Will _not_ track if the value is a getter.
 */
export function peek<T>(value: T | Getter<T>): T {
  const prevSub = setActiveSub(undefined);
  try {
    return unwrap(value);
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
  try {
    callback();
  } finally {
    if (!--batchDepth) {
      flush();
    }
  }
}

export function subscribe<T>(target: Getter<T>, fn: (value: T) => any): () => void {
  return createEffect(() => {
    const value = target();
    peek(() => fn(value));
  });
}
