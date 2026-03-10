import { Store } from "../types";
import { uniqueId } from "../utils";
import { debug } from "./debug";
import { $provide, $setup, $teardown, $use, AsyncSetupCallback, SetupCallback, STORE_ID } from "./hooks";
import { effect, EffectCallback, peek, resumeEffects, type Getter, type MaybeGetter } from "./signals";

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
export function hook<T>(context: Context | undefined, callback: () => T): T {
  const prevContext = setActiveContext(context);
  try {
    return callback();
  } finally {
    setActiveContext(prevContext);
  }
}

export class Core {
  constructor(private context: Context) {}

  get id() {
    return this.context.id;
  }

  get isMounted() {
    return this.context.isMounted;
  }

  get isSuspended() {
    return this.context.isSuspended;
  }

  get state() {
    return this.context.state;
  }

  getName() {
    return this.context.getName();
  }

  setName(name: MaybeGetter<string>) {
    return this.context.setName(name);
  }

  /**
   * Schedules `callback` to run just after the component is mounted.
   * If `callback` returns a function, that function will run when the component is unmounted.
   */
  setup(callback: SetupCallback): void;

  /**
   * Schedules `callback` to run just after the component is mounted.
   * The callback receives an `AbortSignal` that will abort if the component unmounts before the promise resolves.
   * Can return a cleanup function. Cleanup function will not be run if using an async callback and the signal aborts before the promise resolves.
   */
  setup(callback: AsyncSetupCallback): void;

  setup(callback: any) {
    return hook(this.context, () => $setup(callback));
  }

  teardown(callback: () => void) {
    return hook(this.context, () => $teardown(callback));
  }

  provide<Returns, Options>(store: Store<Options, Returns>, options?: Options): Returns {
    return hook(this.context, () => $provide(store, options));
  }

  use<Returns>(store: Store<any, Returns>): Returns {
    return hook(this.context, () => $use(store));
  }

  debug() {
    return debug.bind(this.context);
  }

  effect(callback: EffectCallback) {
    return effect(callback, { context: this.context });
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
