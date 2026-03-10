import { uniqueId } from "../utils";
import { getter, peek, resumeEffects, type Getter, type MaybeGetter } from "./signals";

export type LifecycleListener = () => any;

/*===================================*\
||           Global Context          ||
\*===================================*/

export let getActiveContext: () => Context | undefined;
export let setActiveContext: (context: Context | undefined) => Context | undefined;

if (typeof window !== "undefined") {
  getActiveContext = () => window.DOLLA_CURRENT_CONTEXT;
  setActiveContext = (context) => {
    const prev = window.DOLLA_CURRENT_CONTEXT;
    window.DOLLA_CURRENT_CONTEXT = context;
    return prev;
  };
} else {
  let currentContext: Context | undefined;

  getActiveContext = () => currentContext;
  setActiveContext = (context) => {
    const prev = currentContext;
    currentContext = context;
    return prev;
  };
}

/**
 * Runs `callback` while `context` is active. Hooks may be called inside `callback`.
 */
export function callInContext<T>(context: Context | undefined, callback: () => T): T {
  const prevContext = setActiveContext(context);
  try {
    return callback();
  } finally {
    setActiveContext(prevContext);
  }
}

/*===================================*\
||        Context Definition         ||
\*===================================*/

export class Context {
  readonly id = uniqueId();
  isMounted = false;
  isSuspended = true;
  state: Record<string | symbol, any>;

  #name: Getter<string>;
  #mountListeners?: LifecycleListener[];
  #unmountListeners?: LifecycleListener[];

  protected parent?: Context;

  constructor(name: Getter<string> | string, parent?: Context) {
    this.parent = parent;
    this.#name = getter(name);

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
    this.#name = getter(name);
  }

  mount() {
    if (this.isMounted) return;

    this.isMounted = true;
    this.resume();
    this.#mountListeners?.forEach((callback) => callback());
  }

  unmount() {
    if (!this.isMounted) return;

    this.isMounted = false;
    this.#unmountListeners?.forEach((callback) => callback());
  }

  suspend() {
    // Pause execution of bound effects.
    this.isSuspended = true;
  }

  resume() {
    // Resume bound effects.
    this.isSuspended = false;
    resumeEffects(this);
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
