import { type Context, type Logger, ref, type Ref, type Store } from "../core";
import {
  type EffectFn,
  get,
  getCurrentContext,
  type MaybeSignal,
  memo,
  type Setter,
  signal,
  type Signal,
  type SignalOptions,
  untracked,
  writable,
} from "../core/signals";

/**
 * Returns the Context object of the View, Store or Mixin this hook is called in.
 */
export function useContext(): Context {
  const context = getCurrentContext();
  if (!context) {
    throw new Error(`No context found; hooks can only be called in the body of a View, Store or Mixin.`);
  }
  return context;
}

/**
 * Returns a logger. If a name is passed it will be used as a prefix for all console messages.
 * Otherwise the default name of the context will be used.
 */
export function useLogger(name?: MaybeSignal<string>): Logger {
  const context = useContext();
  if (name) context.setName(name);
  return context;
}

/**
 * Creates a new read-only Getter and a bound Setter function.
 * @deprecated prefer useSignal
 */
export function useState<T>(value: T, options?: SignalOptions<T>): [Signal<T>, Setter<T>];

/**
 * Creates a new read-only Signal and a bound Setter function.
 * @deprecated prefer useSignal
 */
export function useState<T>(
  value: undefined,
  options: SignalOptions<T>,
): [Signal<T | undefined>, Setter<T | undefined>];

/**
 * Creates a new read-only Signal and a bound Setter function.
 * @deprecated prefer useSignal
 */
export function useState<T>(): [Signal<T | undefined>, Setter<T | undefined>];

export function useState<T>(value?: T, options?: SignalOptions<T>): [Signal<T>, Setter<T>] {
  useContext(); // assert that we're in a valid context
  const state = writable(value as T, options);
  return [() => state(), state.set];
}

/**
 * Creates a new read-only Signal. Returns bound Getter and Setter functions.
 *
 * @example
 * const [$count, setCount] = useSignal(5);
 * $count(); // 5
 * setCount(6);
 * setCount((current) => current + 1);
 * $count(); // 7
 */
export function useSignal<T>(value: T, options?: SignalOptions<T>): [Signal<T>, Setter<T>];

export function useSignal<T>(
  value: undefined,
  options: SignalOptions<T>,
): [Signal<T | undefined>, Setter<T | undefined>];

export function useSignal<T>(): [Signal<T | undefined>, Setter<T | undefined>];

export function useSignal<T>(value?: T, options?: SignalOptions<T>): [Signal<T>, Setter<T>] {
  useContext(); // assert that we're in a valid context
  return signal(value as T, options);
}

export function useMemo<T>(
  compute: (current?: T) => MaybeSignal<T>,
  deps?: Signal<any>[],
  options?: SignalOptions<T>,
): Signal<T> {
  useContext(); // assert that we're in a valid context
  return memo(compute, { ...options, deps });
}

export function useEffect(fn: EffectFn, deps?: Signal<any>[]): void {
  const context = useContext();
  if (deps) {
    context.effect(() => {
      for (const dep of deps) get(dep);
      return untracked(fn);
    });
  } else {
    context.effect(fn);
  }
}

/**
 * Takes the current state and a dispatched action. Returns a new state based on the action.
 * Typically the body of this function will be a large switch statement.
 */
export type Reducer<State, Action> = (state: State, action: Action) => State;

/**
 * Dispatches an action to this reducer, causing the state to update.
 */
export type Dispatcher<Action> = (action: Action) => void;

/**
 *
 */
export function useReducer<State, Action>(
  reducer: Reducer<State, Action>,
  initialState: State,
): [Signal<State>, Dispatcher<Action>] {
  const [$state, setState] = useSignal(initialState);
  const dispatch = (action: Action) => {
    setState((current) => reducer(current, action));
  };
  return [$state, dispatch];
}

/**
 * Uses a previously added Store. Takes the Store function itself and returns the nearest instance.
 */
export function useStore<T>(store: Store<any, T>): T {
  const context = useContext();
  return context.getStore(store);
}

/**
 * A hybrid Ref which is both a function ref and a React-style object ref with a `current` property.
 * Both the `current` property and the function syntax access the same value.
 */
export interface HybridRef<T> extends Ref<T> {
  current: T;
}

/**
 * Creates a Ref. Useful for getting references to DOM nodes.
 */
export function useRef<T>(initialValue?: T): HybridRef<T>;

export function useRef<T>(...value: [T]): HybridRef<T> {
  useContext(); // assert that we're in a valid context
  const valueRef = ref(...value);
  Object.defineProperty(valueRef, "current", { get: valueRef, set: valueRef });
  return valueRef as HybridRef<T>;
}

/**
 * Calls `callback` when the context is mounted. If `callback` returns a function, that function is called when the context is unmounted.
 */
export function useMount(callback: () => void | (() => void)): void {
  const context = useContext();
  context.onMount(() => {
    const result = callback();
    if (result) context.onUnmount(result);
  });
}

/**
 * Calls `callback` when the context is unmounted.
 */
export function useUnmount(callback: () => void): void {
  const context = useContext();
  context.onUnmount(callback);
}
