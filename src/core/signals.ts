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

/*==================================*\
||         Debugging Helpers        ||
\*==================================*/

interface ReactiveNodeDebug {
  type: "composed" | "effect";
  name: string;
  creationStack?: string;
}

const componentNameStack: string[] = [];
const reactiveScopeStack: ReactiveNode[] = [];
const nodeDebug = new WeakMap<ReactiveNode, ReactiveNodeDebug>();

/**
 * Pushes the current component name so compose/createEffect can pick it up.
 */
export function pushComponentName(name: string): void {
  componentNameStack.push(name);
}

/**
 * Restores the previous component name after a view function finishes.
 */
export function popComponentName(): void {
  componentNameStack.pop();
}

function setNodeDebug(
  node: ReactiveNode,
  type: ReactiveNodeDebug["type"],
  fn: Function,
  nameOverride?: string,
): void {
  const componentName =
    componentNameStack.length > 0 ? componentNameStack[componentNameStack.length - 1] : undefined;
  const fnName = nameOverride || fn.name || "(anonymous)";
  nodeDebug.set(node, {
    type,
    name: componentName ? `${componentName} → ${fnName}` : fnName,
    creationStack: new Error().stack,
  });
}

function enhanceError(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  if ((error as any)._dollaEnhanced) return error;

  const scopes = reactiveScopeStack.slice();
  if (scopes.length === 0) return error;

  const lines: string[] = ["", "--- Reactive context ---"];
  const total = scopes.length;
  const showAll = total <= 6;
  const headCount = showAll ? total : 3;
  const tailCount = showAll ? 0 : 3;

  for (let i = 0; i < headCount; i++) {
    appendScopeLine(lines, i + 1, scopes[i]);
  }

  if (!showAll) {
    const hidden = total - headCount - tailCount;
    lines.push(`  ... (${hidden} more)`);

    for (let i = total - tailCount; i < total; i++) {
      appendScopeLine(lines, i + 1, scopes[i]);
    }
  }

  const originalMessage = error.message;
  const originalStack = error.stack;
  (error as any)._dollaEnhanced = true;
  error.message += "\n" + lines.join("\n");
  if (!error.cause) {
    const cause = new Error(originalMessage);
    cause.stack = originalStack;
    error.cause = cause;
  }
  return error;
}

function getCreationFrame(stack?: string): string {
  if (!stack) return "";
  const entries = stack.split("\n");
  for (let i = 2; i < entries.length; i++) {
    const line = entries[i].trim();
    if (line.startsWith("at ") && !line.includes("signals.ts")) {
      return line.replace(/^at /, "");
    }
  }
  return "";
}

function appendScopeLine(lines: string[], number: number, node: ReactiveNode): void {
  const info = nodeDebug.get(node);
  if (info) {
    const frame = getCreationFrame(info.creationStack);
    const suffix = frame ? ` created at ${frame}` : "";
    lines.push(`  ${number} → ${info.type} "${info.name}"${suffix}`);
  }
}

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
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(c);
  try {
    const oldValue = c._value;
    return oldValue !== (c._value = c._getter(oldValue));
  } catch (error) {
    throw enhanceError(error);
  } finally {
    activeSub = prevSub;
    c._flags &= ~ReactiveFlags.RecursedCheck;
    purgeDeps(c);
    reactiveScopeStack.length = scopeLen;
  }
}

function updateValue(v: ValueNode): boolean {
  v._flags = ReactiveFlags.Mutable;
  const didChange = v._currentValue !== (v._currentValue = v._pendingValue);
  return v._skipEqualValues ? didChange : true;
}

function run(e: EffectNode): void {
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(e);
  try {
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
      } catch (error) {
        throw enhanceError(error);
      } finally {
        activeSub = prevSub;
        e._flags &= ~ReactiveFlags.RecursedCheck;
        purgeDeps(e);
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

function computedGetter(node: ComputedNode) {
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
  } else if (!flags) {
    node._flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(node);
    const scopeLen = reactiveScopeStack.length;
    reactiveScopeStack.push(node);
    try {
      node._value = unwrap(node._getter());
    } catch (error) {
      throw enhanceError(error);
    } finally {
      activeSub = prevSub;
      node._flags &= ~ReactiveFlags.RecursedCheck;
      reactiveScopeStack.length = scopeLen;
    }
  }
  const sub = activeSub;
  if (sub !== undefined) {
    link(node, sub, cycle);
  }
  return node._value!;
}

function computedSetter(node: ComputedNode, next: SetterAction<any>) {
  const value = resolveValue(next, node._value);
  if (node._value !== value) {
    node._value = value;

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

function customSetter<T>(getter: Getter<T>, callback: (current: T) => T | void, value: SetterAction<T>): T {
  const next = typeof value === "function" ? (value as (current: T) => T)(peek(getter)) : value;
  const returned = callback(next);
  return returned ?? next;
}

function effectCleanup(node: ReactiveNode): void {
  node._depsTail = undefined;
  node._flags = ReactiveFlags.None;
  purgeDeps(node);
  const sub = node._subs;
  if (sub !== undefined) {
    unlink(sub);
  }
  (node as EffectNode)._cleanup?.();
  (node as EffectNode)._cleanup = undefined;
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
  return (value: SetterAction<T>) => customSetter(getter, callback as any, value);
}

/**
 * Creates a derived/computed signal from a function that tracks dependencies.
 * Returns a lazy getter that only recomputes when a dependency changes.
 * Also accepts a plain value to create a constant getter (reverse unwrap).
 */
export function compose<T>(getter: T | ((previousValue?: T) => Getter<T> | T), options?: { name?: string }): Getter<T> {
  if (!isFunction(getter)) {
    // Creates a getter out of a plain value; reverse unwrap.
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

function _depsGetter(deps: MaybeGetter<any>[], fn: (...values: any[]) => void) {
  const values = deps.map((dep) => unwrap(dep));
  return peek(() => fn(...values));
}

export type Unwrapped<T> = {
  [K in keyof T]: T[K] extends () => infer R ? R : T[K];
};

/**
 * Creates an effect with auto-tracking for getters called within its callback.
 */
export function createEffect(fn: () => void, options?: { name?: string }): () => void;

/**
 * Creates an effect that tracks getters in its `deps` array.
 * Unwrapped values from `deps` are passed as arguments to the callback.
 * For backwards compatibility, `options` can also be a bare deps array.
 */
export function createEffect<const T extends readonly any[]>(
  fn: (...values: Unwrapped<T>) => void,
  options?: T | { deps?: T; name?: string },
): () => void;

export function createEffect(
  fn: (...values: any[]) => void,
  options?: any[] | { deps?: any[]; name?: string },
): () => void {
  if (Array.isArray(options)) options = { deps: options };
  const deps = options?.deps;
  const optsName = options?.name;

  const e: EffectNode = {
    _fn: deps ? () => _depsGetter(deps, fn) : fn,
    _cleanup: undefined,
    _subs: undefined,
    _subsTail: undefined,
    _deps: undefined,
    _depsTail: undefined,
    _flags: ReactiveFlags.Watching | ReactiveFlags.RecursedCheck,
  };
  setNodeDebug(e, "effect", fn, optsName);
  const prevSub = setActiveSub(e);
  if (prevSub !== undefined) {
    link(e, prevSub, 0);
  }
  const scopeLen = reactiveScopeStack.length;
  reactiveScopeStack.push(e);
  try {
    const result = e._fn();
    if (isFunction(result)) e._cleanup = result;
  } catch (error) {
    throw enhanceError(error);
  } finally {
    activeSub = prevSub;
    e._flags &= ~ReactiveFlags.RecursedCheck;
    reactiveScopeStack.length = scopeLen;
  }
  return () => effectCleanup(e);
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
  } catch (error) {
    throw enhanceError(error);
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

/**
 * Subscribes to a getter and runs the callback whenever its value changes.
 * Returns an unsubscribe function.
 */
export function subscribe<T>(target: Getter<T>, fn: (value: T) => any): () => void {
  return createEffect(() => {
    const value = target();
    peek(() => fn(value));
  });
}
