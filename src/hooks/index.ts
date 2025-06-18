import { Context, Logger, ref, type Ref, type Store } from "../core";
import { $, type EffectFn, get, getCurrentContext, MaybeSignal, type Signal, untracked } from "../core/signals";

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
 * Sets the value of the Signal it is bound to.
 */
export interface Setter<T> {
  (value: T): void;
  (fn: (current: T) => T): void;
}

/**
 * Creates a new read-only Signal and a bound Setter function.
 */
export function useState<T>(value: T): [Signal<T>, Setter<T>];

/**
 * Creates a new read-only Signal and a bound Setter function.
 */
export function useState<T>(): [Signal<T | undefined>, Setter<T | undefined>];

export function useState<T>(value?: T): [Signal<T>, Setter<T>] {
  useContext(); // assert that we're in a valid context
  const $value = $(value);
  return [() => $value() as T, $value];
}

export function useMemo<T>(compute: (current?: T) => MaybeSignal<T>, deps?: Signal<any>[]): Signal<T> {
  useContext(); // assert that we're in a valid context
  if (deps) {
    return $(function () {
      // Track deps and run `compute` untracked.
      for (const dep of deps) get(dep);
      return untracked(() => compute(this.value));
    });
  } else {
    return $(function () {
      return compute(this.value);
    });
  }
}

export function useEffect(fn: EffectFn, deps?: Signal<any>[]): void {
  const context = useContext();
  if (deps) {
    context.effect(() => {
      // Track deps and run `fn` untracked.
      for (const dep of deps) get(dep);
      untracked(fn);
    });
  } else {
    context.effect(fn);
  }
}

// TODO: What would layout effect even mean in dolla?
// export function useLayoutEffect() {}

/**
 * Takes the current state and a dispatched action. Returns a new state based on the action.
 * Typically the body of this function will be a large switch statement.
 */
export type ReducerFn<State, Action> = (state: State, action: Action) => State;

/**
 * Dispatches an action to this reducer, causing the state to update.
 */
export type DispatchFn<Action> = (action: Action) => void;

/**
 *
 */
export function useReducer<State, Action>(
  reducer: ReducerFn<State, Action>,
  initialState: State,
): [Signal<State>, DispatchFn<Action>] {
  const [state, setState] = useState(initialState);
  const dispatch = (action: Action) => {
    setState((current) => reducer(current, action));
  };
  return [state, dispatch];
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
