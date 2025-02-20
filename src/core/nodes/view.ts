import { isArrayOf, isFunction, typeOf } from "../../typeChecking.js";
import { Renderable } from "../../types.js";
import { getUniqueId } from "../../utils.js";
import type { ComponentContext, ElementContext, StoreConsumerContext, StoreProviderContext } from "../context.js";
import type { Logger } from "../dolla.js";
import { constructMarkup, createMarkup, groupElements, isMarkup, type Markup, type MarkupElement } from "../markup.js";
import { atom, effect, isReactive, type EffectCallback, type Reactive, type UnsubscribeFunction } from "../signals.js";
import { Store, StoreError, StoreFunction } from "../store.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Reactive<any> | Markup | Markup[] | null;

export type ViewFunction<P> = (this: ViewContext, props: P, context: ViewContext) => ViewResult;

/**
 * A view that has been constructed into DOM nodes.
 */
export interface ViewElement extends MarkupElement {
  /**
   * Take a ViewFunction and render it as a child of this view.
   */
  setChildView(view: ViewFunction<{}>): ViewElement;
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
   * Returns a Markup element that displays this view's children.
   */
  outlet(): Markup;
}

/*=====================================*\
||              View Init              ||
\*=====================================*/

// class ViewTemplate<Props> {
//   private _fn;

//   constructor(fn: ViewFunction<Props>) {
//     this._fn = fn;
//   }

//   create(ctx: ElementContext, props: Props, children: Markup[]): View<Props> {
//     return new View(ctx, this._fn, props, children);
//   }

//   toString(ctx: ElementContext, props: Props, children: Markup[]): string {
//     // TODO: Render this view's content as an HTML string.
//     return "";
//   }
// }

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
    return this.view.elementContext.viewName || this.view.uniqueId;
  }

  set name(value) {
    this.view.elementContext.viewName = value;
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
    if (this.view.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = effect(callback);
      this.view.lifecycleListeners.unmount.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFunction | undefined;
      let disposed = false;
      this.view.lifecycleListeners.mount.push(() => {
        if (!disposed) {
          unsubscribe = effect(callback);
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
    return createMarkup("$outlet", { children: this.view.children });
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

  childMarkup;

  children = atom<MarkupElement[]>([]);

  lifecycleListeners: {
    beforeMount: (() => any)[];
    mount: (() => any)[];
    beforeUnmount: (() => any)[];
    unmount: (() => any)[];
  } = { beforeMount: [], mount: [], beforeUnmount: [], unmount: [] };

  constructor(elementContext: ElementContext, fn: ViewFunction<P>, props: P, children: Markup[] = []) {
    this.elementContext = {
      ...elementContext,
      parent: elementContext,
      viewName: fn.name,
      stores: new Map(),
    };
    this.logger = elementContext.root.createLogger(fn.name || "🌇 anonymous view", { uid: this.uniqueId });
    this.props = props;
    this.fn = fn;

    this.childMarkup = children;
  }

  /*===============================*\
  ||         "Public" API          ||
  \*===============================*/

  get node() {
    return this.element?.node!;
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

      // TODO: Figure out why rAF is needed for updates to DOM nodes to work in onMount callbacks.
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

  setChildView(fn: ViewFunction<{}>) {
    this.childMarkup = [];
    const node = new View(this.elementContext, fn, {});
    this.children.value = [node];
    return node;
  }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  private _initialize() {
    const context = new Context(this);

    let result: ViewResult;
    try {
      result = this.fn.call(context, this.props, context);

      if (this.childMarkup.length) {
        this.children.value = constructMarkup(this.elementContext, this.childMarkup);
      }
    } catch (error) {
      if (error instanceof Error) {
        this.logger.crash(error);
      }
      throw error;
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      this.element = groupElements(constructMarkup(this.elementContext, createMarkup("$node", { value: result })));
    } else if (isReactive(result)) {
      this.element = groupElements(
        constructMarkup(this.elementContext, createMarkup("$dynamic", { source: result as Reactive<Renderable> })),
      );
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      this.element = groupElements(constructMarkup(this.elementContext, result));
    } else {
      const error = new TypeError(
        `Expected '${
          this.fn.name
        }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`,
      );
      this.logger.crash(error);
    }
  }
}
