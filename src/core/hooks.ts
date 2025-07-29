import { type Context, ref, type Ref, type Store } from "../core";
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
} from "../core/signals";

/**
 * Returns the Context object of the `View`, `Store` or `Mixin` this hook is called in.
 *
 * @param name - If passed, the context will be renamed. Context takes the name of the component function by default.
 */
export function useContext(name?: MaybeSignal<string>): Context {
  const context = getCurrentContext();
  if (!context) {
    throw new Error(`No context found; hooks can only be called in the body of a View, Store or Mixin.`);
  }
  if (name != null) {
    context.setName(name);
  }
  return context;
}

/**
 * Returns the nearest instance of a Store provided to this context.
 */
export function useStore<T>(store: Store<any, T>): T {
  return useContext().getStore(store);
}

/**
 * Adds a store to this context and returns the store instance.
 */
export function useStoreProvider<T, O>(store: Store<O, T>, options?: O): T {
  return useContext().addStore(store, options).getStore(store);
}

/**
 * Schedules `callback` to run just after the component is mounted.
 * If `callback` returns a function, that function will run when the context is unmounted.
 */
export function useMount(callback: () => void | (() => void)): void {
  const context = useContext();
  context.onLifecycleTransition("didMount", () => {
    const result = callback();
    if (result) context.onLifecycleTransition("didUnmount", result);
  });
}

/**
 * Schedules `callback` to run when the context is unmounted.
 */
export function useUnmount(callback: () => void): void {
  useContext().onLifecycleTransition("didUnmount", callback);
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
  useContext(); // Ensure we're called within a context.
  return signal(value as T, options);
}

export function useMemo<T>(
  compute: (current?: T) => MaybeSignal<T>,
  deps?: Signal<any>[],
  options?: SignalOptions<T>,
): Signal<T> {
  useContext(); // Ensure we're called within a context.
  return memo(compute, { ...options, deps });
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
 * Creates an effect bound to the current context.
 * The `fn` is called when the component is mounted, then again each time the dependencies are updated until the component is unmounted.
 */
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
 * A hybrid Ref which is both a function ref and a React-style object ref with a `current` property.
 * Both the `current` property and the function syntax access the same value.
 */
export interface HybridRef<T> extends Ref<T> {
  current: T;
}

/**
 * Creates a Ref. Useful for getting references to DOM nodes.
 *
 * @deprecated use ref()
 */
export function useRef<T>(initialValue?: T): HybridRef<T>;

export function useRef<T>(...value: [T]): HybridRef<T> {
  useContext(); // assert that we're in a valid context
  const valueRef = ref(...value);
  Object.defineProperty(valueRef, "current", { get: valueRef, set: valueRef });
  return valueRef as HybridRef<T>;
}
