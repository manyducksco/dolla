import { assertFunction } from "../typeChecking";
import type { Store } from "../types";
import { IdGenerator } from "../utils";
import { get, type Getter, type MaybeReactive, type MaybeTrackable, type Reactive } from "./reactive";

export type LifecycleListener = () => any;

export interface LinkedContextOptions {
  bindLifecycle?: boolean;
}

/*===================================*\
||           Global Context          ||
\*===================================*/

let _get: () => Context | undefined;
let _set: (context: Context | undefined) => Context | undefined;

if (typeof window !== "undefined") {
  _get = () => window.DOLLA_CURRENT_CONTEXT;
  _set = (context) => {
    const prev = window.DOLLA_CURRENT_CONTEXT;
    window.DOLLA_CURRENT_CONTEXT = context;
    return prev;
  };
} else {
  let currentContext: Context | undefined;

  _get = () => currentContext;
  _set = (context) => {
    const prev = currentContext;
    currentContext = context;
    return prev;
  };
}

export function getCurrentContext(): Context | undefined {
  return _get();
}

export function setCurrentContext(context: Context | undefined) {
  return _set(context);
}

export function runWithContext(context: Context | undefined, callback: () => void) {
  const prevContext = _set(context);
  try {
    callback();
  } finally {
    _set(prevContext);
  }
}

/*===================================*\
||        Context Definition         ||
\*===================================*/

const STORE_ID = Symbol("Dolla.StoreId");

const contextIds = new IdGenerator();

export class Context {
  readonly id = contextIds.next();
  #name: MaybeTrackable<string>;

  isMounted = false;
  mountListeners?: LifecycleListener[];
  unmountListeners?: LifecycleListener[];

  bound?: Context[];

  // lifecycle = new ContextLifecycle(this);
  parent?: Context;
  state: Record<string | symbol, any>;

  constructor(name: Reactive<string> | Getter<string> | string, parent?: Context) {
    this.parent = parent;
    this.#name = name;

    // Inherit parent state as prototype for quick lookups.
    this.state = parent ? Object.create(parent.state) : {};
  }

  /**
   * Returns a new Context with this one as its parent.
   */
  createChild(name: MaybeReactive<string> | Getter<string>, options?: LinkedContextOptions): Context {
    const context = new Context(name, this);

    if (options?.bindLifecycle) {
      if (!this.bound) this.bound = [];
      if (!this.bound.includes(context)) {
        this.bound.push(context);
      }
    }

    return context;
  }

  // -------------------------- \\
  //        Context Info        \\
  // ---------------------------\\

  /**
   * Returns the current name of this context.
   */
  getName(): string {
    return get(this.#name);
  }

  /**
   * Sets a new name for this context.
   */
  setName(name: Reactive<string> | Getter<string> | string) {
    this.#name = name;
  }

  // -------------------------- \\
  //      Lifecycle Events      \\
  // ---------------------------\\

  onMount(listener: LifecycleListener) {
    if (!this.mountListeners) this.mountListeners = [];
    this.mountListeners.push(listener);

    return () => {
      const list = this.mountListeners;
      if (list) {
        const index = list.indexOf(listener);
        if (index !== -1) list.splice(index, 1);
      }
    };
  }

  onUnmount(listener: LifecycleListener) {
    if (!this.unmountListeners) this.unmountListeners = [];
    this.unmountListeners.push(listener);

    return () => {
      const list = this.unmountListeners;
      if (list) {
        const index = list.indexOf(listener);
        if (index !== -1) list.splice(index, 1);
      }
    };
  }

  mount() {
    if (this.isMounted) return;

    this.isMounted = true;
    this.mountListeners?.forEach((callback) => {
      callback();
    });

    // Update bound contexts.
    if (this.bound) {
      for (let i = 0; i < this.bound.length; i++) {
        this.bound[i].mount();
      }
    }
  }

  unmount() {
    if (!this.isMounted) return;

    this.isMounted = false;
    this.unmountListeners?.forEach((callback) => {
      callback();
    });

    // Update bound contexts.
    if (this.bound) {
      for (let i = 0; i < this.bound.length; i++) {
        this.bound[i].unmount();
      }
    }
  }

  // -------------------------- \\
  //     Stores (provide/use)   \\
  // ---------------------------\\

  /**
   * Creates an instance of a store and provides it via this context.
   */
  provideStore<T>(store: Store<any, T> & { [STORE_ID]?: symbol }, options?: any): T {
    // Tag the store function with a unique symbol if it doesn't have one.
    if (!store[STORE_ID]) store[STORE_ID] = Symbol(store.name);

    if (this.state.hasOwnProperty(store[STORE_ID])) {
      let name = store.name ? `'${store.name}'` : "this store";
      throw new Error(`An instance of ${name} was already provided on this context.`);
    }

    // Context is bound and therefore will be disposed when this context is disposed.
    const context = this.createChild(store.name, {
      bindLifecycle: true,
    });

    runWithContext(context, () => {
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
    assertFunction(store, "Expected a store function. Got: %t");

    const id = store[STORE_ID];
    const result = id ? this.state[id] : undefined;
    if (result == null) {
      throw new Error(`Store '${store.name}' is not provided by this context.`);
    }
    return result as T;
  }
}
