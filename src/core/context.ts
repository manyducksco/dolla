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
export function contextualize<T>(context: Context | undefined, callback: () => T): T {
  const prevContext = setCurrentContext(context);
  try {
    return callback();
  } finally {
    setCurrentContext(prevContext);
  }
}

/*===================================*\
||        Context Definition         ||
\*===================================*/

export class Context {
  readonly id = uniqueId();
  isMounted = false;
  state: Record<string | symbol, any>;

  #name: MaybeGetter<string>;
  #mountListeners?: LifecycleListener[];
  #unmountListeners?: LifecycleListener[];

  protected parent?: Context;

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

  getName(): string {
    return peek(this.#name);
  }

  setName(name: MaybeGetter<string>) {
    this.#name = name;
  }

  mount() {
    if (this.isMounted) return;

    this.isMounted = true;
    this.#mountListeners?.forEach((callback) => callback());
  }

  unmount() {
    if (!this.isMounted) return;

    this.isMounted = false;
    this.#unmountListeners?.forEach((callback) => callback());
  }

  onMount(listener: LifecycleListener) {
    if (!this.#mountListeners) this.#mountListeners = [];
    this.#mountListeners.push(listener);
    return this.#unsubscribe.bind(this.#mountListeners);
  }

  onUnmount(listener: LifecycleListener) {
    if (!this.#unmountListeners) this.#unmountListeners = [];
    this.#unmountListeners.push(listener);
    return this.#unsubscribe.bind(this.#unmountListeners);
  }

  #unsubscribe(this: LifecycleListener[], listener: LifecycleListener) {
    if (!this) return;
    const index = this.indexOf(listener);
    if (index !== -1) this.splice(index, 1);
  }
}
