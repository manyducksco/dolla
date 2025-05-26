import { isArrayOf, isFunction, typeOf } from "../../typeChecking.js";
import { Renderable } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import type { ComponentContext, ElementContext, StoreConsumerContext, StoreProviderContext } from "../context.js";
import type { Logger } from "../dolla.js";
import { constructMarkup, groupElements, isMarkup, markup, type Markup, type MarkupElement } from "../markup.js";
import { type Signal, effect, type EffectCallback, type UnsubscribeFunction, $ } from "../signals-api.js";
import { Store, StoreError, StoreFunction } from "../store.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Signal<any> | Markup | Markup[] | null;

export type ViewFunction<P> = (this: ViewContext, props: P, context: ViewContext) => ViewResult;

/**
 * A view that has been constructed into DOM nodes.
 */
export interface ViewElement extends MarkupElement {
  setRouteView(view: ViewFunction<{}>): ViewElement;
}

export interface ViewContext
  extends Omit<Logger, "setName">,
    ComponentContext,
    StoreProviderContext,
    StoreConsumerContext {
  /**
   * An ID unique to this view.
   */
  readonly uid: string;

  /**
   * True while this view is connected to the DOM.
   */
  readonly isMounted: boolean;

  /**
   * Registers a callback to run just before this view is mounted. DOM nodes are not yet attached to the page.
   */
  beforeMount(callback: () => void): void;

  /**
   * Registers a callback to run just after this view is mounted.
   */
  onMount(callback: () => void): void;

  /**
   * Registers a callback to run just before this view is unmounted. DOM nodes are still attached to the page.
   */
  beforeUnmount(callback: () => void): void;

  /**
   * Registers a callback to run just after this view is unmounted.
   */
  onUnmount(callback: () => void): void;

  /**
   * Passes a getter function to `callback` that will track reactive states and return their current values.
   * Callback will be run each time a tracked state gets a new value.
   */
  effect(callback: EffectCallback): UnsubscribeFunction;

  /**
   * Displays this view's subroutes if mounted as a router view.
   */
  outlet(): Markup;
}

/*=====================================*\
||              View Init              ||
\*=====================================*/

// Defines logger methods on context.
interface Context extends Omit<Logger, "setName"> {}

class Context implements ViewContext {
  private view;

  constructor(view: View<any>) {
    this.view = view;

    // Copy logger methods from logger.
    const descriptors = Object.getOwnPropertyDescriptors(this.view.logger);
    for (const key in descriptors) {
      if (key !== "setName") {
        Object.defineProperty(this, key, descriptors[key]);
      }
    }
  }

  get uid() {
    return this.view.uniqueId;
  }

  get isMounted() {
    return this.view.isMounted;
  }

  get name() {
    return this.view.name || this.uid;
  }

  set name(value) {
    this.view.name = value;
    this.view.logger.setName(value);
  }

  provide<Value>(store: StoreFunction<any, Value>, options?: any): Value {
    const instance = new Store(store, options);
    const attached = instance.attach(this.view.elementContext);
    if (attached) {
      this.view.lifecycleListeners.mount.push(() => {
        instance.handleMount();
      });
      this.view.lifecycleListeners.unmount.push(() => {
        instance.handleUnmount();
      });
      return instance.value;
    } else {
      let name = store.name ? `'${store.name}'` : "this store";
      this.view.logger.warn(`An instance of ${name} was already attached to this context.`);
      return this.get(store);
    }
  }

  get<Value>(store: StoreFunction<any, Value>): Value {
    if (isFunction(store)) {
      let context = this.view.elementContext;
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
    this.view.lifecycleListeners.beforeMount.push(callback);
  }

  onMount(callback: () => void): void {
    this.view.lifecycleListeners.mount.push(callback);
  }

  beforeUnmount(callback: () => void): void {
    this.view.lifecycleListeners.beforeUnmount.push(callback);
  }

  onUnmount(callback: () => void): void {
    this.view.lifecycleListeners.unmount.push(callback);
  }

  effect(callback: EffectCallback) {
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

    if (this.view.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(fn);
      this.view.lifecycleListeners.unmount.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFunction | undefined;
      let disposed = false;
      this.view.lifecycleListeners.mount.push(() => {
        if (!disposed) {
          unsubscribe = effect(fn);
          this.view.lifecycleListeners.unmount.push(unsubscribe);
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

  outlet(): Markup {
    return markup("$outlet", { view: this.view.elementContext.route! });
    // return createMarkup("$fragment", { children: this.view.children });
  }
}

export class View<P> implements ViewElement {
  [IS_MARKUP_ELEMENT] = true;

  uniqueId = getUniqueId();

  elementContext: ElementContext;
  logger;
  props;
  fn;

  element?: MarkupElement;

  name;
  context: Context;

  lifecycleListeners: {
    beforeMount: (() => any)[];
    mount: (() => any)[];
    beforeUnmount: (() => any)[];
    unmount: (() => any)[];
  } = { beforeMount: [], mount: [], beforeUnmount: [], unmount: [] };

  constructor(elementContext: ElementContext, fn: ViewFunction<P>, props: P, children?: Markup[]) {
    this.name = fn.name || "🌇 anonymous view";
    this.elementContext = {
      ...elementContext,
      parent: elementContext,
      view: this,
      stores: new Map(),
      route: $<View<{}>>(),
    };
    this.logger = elementContext.root.createLogger(this.name, { uid: this.uniqueId });
    this.props = {
      ...props,
      children,
    };
    this.fn = fn;
    this.context = new Context(this);
  }

  /*===============================*\
  ||         "Public" API          ||
  \*===============================*/

  get domNode() {
    return this.element?.domNode!;
  }

  isMounted = false;

  mount(parent: Node, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasConnected = this.isMounted;

    if (!wasConnected) {
      this._initialize();
      for (const listener of this.lifecycleListeners.beforeMount) {
        listener();
      }
    }

    if (this.element) {
      this.element.mount(parent, after);
    }

    if (!wasConnected) {
      this.isMounted = true;

      requestAnimationFrame(() => {
        for (const listener of this.lifecycleListeners.mount) {
          listener();
        }
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    for (const listener of this.lifecycleListeners.beforeUnmount) {
      listener();
    }

    if (this.element) {
      // parentIsUnmounting is forwarded to the element because the view acts as a proxy for an element.
      this.element.unmount(parentIsUnmounting);
    }

    this.isMounted = false;

    for (const listener of this.lifecycleListeners.unmount) {
      listener();
    }

    this.lifecycleListeners.beforeMount.length = 0;
    this.lifecycleListeners.mount.length = 0;
    this.lifecycleListeners.beforeUnmount.length = 0;
    this.lifecycleListeners.unmount.length = 0;
  }

  setRouteView(fn: ViewFunction<{}>) {
    const node = new View(this.elementContext, fn, {});

    this.elementContext.route!(node);

    return node;
  }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  private _initialize() {
    const { context } = this;

    let result: ViewResult;
    try {
      result = this.fn.call(context, this.props, context);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.crash(error);
      }
      throw error;
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      this.element = groupElements(constructMarkup(this.elementContext, markup("$node", { value: result })));
    } else if (isFunction(result)) {
      this.element = groupElements(
        constructMarkup(this.elementContext, markup("$dynamic", { source: result as Signal<Renderable> })),
      );
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      this.element = groupElements(constructMarkup(this.elementContext, result));
    } else {
      const error = new TypeError(
        `Expected '${
          this.fn.name
        }' function to return a DOM node, Markup element, Signal or null. Got: ${typeOf(result)}`,
      );
      this.logger.crash(error);
    }
  }
}
