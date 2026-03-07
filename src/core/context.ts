import { assertTypeOf, isFunction } from "../typeChecking";
import type { Store } from "../types";
import { uniqueId } from "../utils";
import { peek, type Getter, type MaybeGetter } from "./reactive";

export type LifecycleListener = () => any;

/*===================================*\
||           Global Context          ||
\*===================================*/

export let getCurrentContext: () => Context | undefined;
export let setCurrentContext: (context: Context | undefined) => Context | undefined;

if (typeof window !== "undefined") {
  getCurrentContext = () => window.DOLLA_CURRENT_CONTEXT;
  setCurrentContext = (context) => {
    const prev = window.DOLLA_CURRENT_CONTEXT;
    window.DOLLA_CURRENT_CONTEXT = context;
    return prev;
  };
} else {
  let currentContext: Context | undefined;

  getCurrentContext = () => currentContext;
  setCurrentContext = (context) => {
    const prev = currentContext;
    currentContext = context;
    return prev;
  };
}

/**
 * Runs `callback` with `context` active so hooks will function.
 */
export function contextualize(context: Context | undefined, callback: () => void) {
  const prevContext = setCurrentContext(context);
  try {
    callback();
  } finally {
    setCurrentContext(prevContext);
  }
}

/*===================================*\
||        Context Definition         ||
\*===================================*/

const STORE_ID = Symbol("Dolla.StoreId");

export class Context {
  readonly id = uniqueId();

  #name: MaybeGetter<string>;

  isMounted = false;
  mountListeners?: LifecycleListener[];
  unmountListeners?: LifecycleListener[];

  parent?: Context;

  state: Record<string | symbol, any>;

  constructor(name: Getter<string> | string, parent?: Context) {
    this.parent = parent;
    this.#name = name;

    // Inherit parent state as prototype for quick lookups.
    this.state = parent ? Object.create(parent.state) : {};
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  createChild(name: MaybeGetter<string>): Context {
    return new Context(name, this);
  }

  // -------------------------- \\
  //        Context Info        \\
  // ---------------------------\\

  /**
   * Returns the current name of this context.
   */
  getName(): string {
    return peek(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: MaybeGetter<string>) {
    this.#name = name;
  }

  // -------------------------- \\
  //      Lifecycle Events      \\
  // ---------------------------\\

  onMount(listener: LifecycleListener) {
    if (!this.mountListeners) this.mountListeners = [];
    this.mountListeners.push(listener);
    return this.unsubscribe.bind(this.mountListeners);
  }

  onUnmount(listener: LifecycleListener) {
    if (!this.unmountListeners) this.unmountListeners = [];
    this.unmountListeners.push(listener);
    return this.unsubscribe.bind(this.unmountListeners);
  }

  private unsubscribe(this: LifecycleListener[], listener: LifecycleListener) {
    if (!this) return;
    const index = this.indexOf(listener);
    if (index !== -1) this.splice(index, 1);
  }

  mount() {
    if (this.isMounted) return;

    this.isMounted = true;
    this.mountListeners?.forEach((callback) => callback());
  }

  unmount() {
    if (!this.isMounted) return;

    this.isMounted = false;
    this.unmountListeners?.forEach((callback) => callback());
  }

  // -------------------------- \\
  //     Stores (provide/use)   \\
  // ---------------------------\\

  /**
   * Creates an instance of a store and provides it via this context.
   */
  provideStore<T>(store: Store<any, T> & { [STORE_ID]?: symbol }, options?: any): T {
    assertTypeOf(store, isFunction, "Expected a store function. Got: %t");

    // Tag the store function with a unique symbol if it doesn't have one.
    if (!store[STORE_ID]) store[STORE_ID] = Symbol(store.name);

    if (this.state.hasOwnProperty(store[STORE_ID])) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw new Error(`An instance of ${name} was already provided on this context.`);
    }

    // Give the store its own context bound to this lifecycle.
    const context = this.createChild(store.name);
    this.onMount(context.mount.bind(context));
    this.onUnmount(context.unmount.bind(context));

    contextualize(context, () => {
      this.state[store[STORE_ID]!] = store(options);
    });

    return this.state[store[STORE_ID]];
  }

  /**
   * Retrieves the nearest instance of `store`.
   * 1. An instance of the store is found and returned.
   * 2. No instance is found and an error is thrown.
   */
  getStore<T>(store: Store<any, T> & { [STORE_ID]?: symbol }): T {
    assertTypeOf(store, isFunction, "Expected a store function. Got: %t");

    const id = store[STORE_ID];
    const result = id ? this.state[id] : undefined;
    if (result == null) {
      throw new Error(`Store '${store.name}' is not provided by this context.`);
    }
    return result as T;
  }
}
