import { isFunction } from "../typeChecking";
import { getUniqueId } from "../utils";
import type { StoreConsumerContext } from "./context";
import { createLogger, type Logger } from "./logger";
import type { HTML } from "./nodes/html";
import { effect, type EffectFn, type UnsubscribeFn } from "./signals";
import { Store, StoreError, StoreFunction } from "./store";

export interface MixinContext extends Logger, StoreConsumerContext {
  /**
   * An ID unique to this element.
   */
  readonly uid: string;

  /**
   * True while this element is connected to the DOM.
   */
  readonly isMounted: boolean;

  /**
   * Registers a callback to run just before this element is mounted. DOM nodes are not yet attached to the page.
   */
  beforeMount(callback: () => void): void;

  /**
   * Registers a callback to run just after this element is mounted.
   */
  onMount(callback: () => void): void;

  /**
   * Registers a callback to run just before this element is unmounted. DOM nodes are still attached to the page.
   */
  beforeUnmount(callback: () => void): void;

  /**
   * Registers a callback to run just after this element is unmounted.
   */
  onUnmount(callback: () => void): void;

  /**
   * Passes a getter function to `callback` that will track reactive states and return their current values.
   * Callback will be run each time a tracked state gets a new value.
   */
  effect(callback: EffectFn): UnsubscribeFn;
}

export type Mixin<E extends Element = Element> = (element: E, context: MixinContext) => void;

function getLoggerName(html: HTML) {
  let name = html.domNode.tagName.toLowerCase();
  if (html.domNode.id) {
    name += `#${html.domNode.id}`;
  }
  if (html.domNode.classList.length > 0) {
    for (const className of html.domNode.classList.values()) {
      name += `.${className}`;
    }
  }
  return name;
}

// Defines logger methods on context.
interface Context extends Logger {}

class Context implements MixinContext {
  private html;
  private controller;

  constructor(html: HTML, controller: MixinController) {
    this.html = html;
    this.controller = controller;

    // Copy logger methods from logger.
    const logger = createLogger(() => getLoggerName(html), { tag: "mixin" });
    const descriptors = Object.getOwnPropertyDescriptors(logger);
    for (const key in descriptors) {
      Object.defineProperty(this, key, descriptors[key]);
    }
  }

  readonly uid = getUniqueId();

  get isMounted() {
    return this.html.isMounted;
  }

  get<Value>(store: StoreFunction<any, Value>): Value {
    if (isFunction(store)) {
      let context = this.html.elementContext;
      let instance: Store<any, Value> | undefined;
      while (true) {
        instance = context.stores.get(store);
        if (instance == null && context.parent != null) {
          context = context.parent;
        } else {
          break;
        }
      }
      if (instance == null) {
        throw new StoreError(`Store '${store.name}' is not provided on this context.`);
      } else {
        return instance.value;
      }
    } else {
      throw new StoreError(`Invalid store.`);
    }
  }

  beforeMount(callback: () => void): void {
    this.controller.lifecycleListeners.beforeMount.push(callback);
  }

  onMount(callback: () => void): void {
    this.controller.lifecycleListeners.mount.push(callback);
  }

  beforeUnmount(callback: () => void): void {
    this.controller.lifecycleListeners.beforeUnmount.push(callback);
  }

  onUnmount(callback: () => void): void {
    this.controller.lifecycleListeners.unmount.push(callback);
  }

  effect(callback: EffectFn) {
    const fn = () => {
      try {
        // Return callback so cleanup function passes through
        return callback();
      } catch (error) {
        this.error(error);
        if (error instanceof Error) {
          this.crash(error);
        } else if (typeof error === "string") {
          this.crash(new Error(error));
        } else {
          this.crash(new Error(`Unknown error thrown in effect callback`));
        }
      }
    };

    if (this.html.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(fn);
      this.controller.lifecycleListeners.unmount.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFn | undefined;
      let disposed = false;
      this.controller.lifecycleListeners.mount.push(() => {
        if (!disposed) {
          unsubscribe = effect(fn);
          this.controller.lifecycleListeners.unmount.push(unsubscribe);
        }
      });
      return () => {
        if (unsubscribe != null) {
          disposed = true;
          unsubscribe();
        }
      };
    }
  }
}

export class MixinController {
  context;
  lifecycleListeners: Record<string, (() => void)[]> = {
    beforeMount: [],
    mount: [],
    beforeUnmount: [],
    unmount: [],
  };

  constructor(html: HTML, mixins: Mixin[]) {
    this.context = new Context(html, this);
    for (const fn of mixins) {
      fn(html.domNode, this.context);
    }
  }

  beforeMount() {
    try {
      for (const listener of this.lifecycleListeners.beforeMount) {
        listener();
      }
    } catch (error) {
      this.context.crash(error as Error);
    }
  }

  onMount() {
    try {
      for (const listener of this.lifecycleListeners.mount) {
        listener();
      }
    } catch (error) {
      this.context.crash(error as Error);
    }
  }

  beforeUnmount() {
    try {
      for (const listener of this.lifecycleListeners.beforeUnmount) {
        listener();
      }
    } catch (error) {
      this.context.crash(error as Error);
    }
  }

  onUnmount() {
    try {
      for (const listener of this.lifecycleListeners.unmount) {
        listener();
      }
    } catch (error) {
      this.context.crash(error as Error);
    }
  }
}
