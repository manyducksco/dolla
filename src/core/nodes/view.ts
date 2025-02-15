import { Emitter } from "@manyducks.co/emitter";
import { isArrayOf, isFunction, typeOf } from "../../typeChecking.js";
import { getUniqueId, noOp } from "../../utils.js";
import {
  type ComponentContext,
  ContextEvent,
  type ElementContext,
  type GenericEvents,
  type StoreProviderContext,
  type StoreUserContext,
  type WildcardListenerMap,
} from "../context.js";
import type { Logger } from "../dolla.js";
import { constructMarkup, createMarkup, groupElements, isMarkup, type Markup, type MarkupElement } from "../markup.js";
import { atom, compose, Reactive, type EffectCallback, type UnsubscribeFunction } from "../reactive.js";
import { createWatcher, isState, type MaybeState, type State, type StateValues, type StopFunction } from "../state.js";
import { _onViewMounted, _onViewUnmounted } from "../stats.js";
import { Store, StoreError, StoreFunction } from "../store.js";
import { IS_MARKUP_ELEMENT } from "../symbols.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Reactive<any> | State<any> | Markup | Markup[] | null;

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

export interface ViewContext<Events extends GenericEvents = GenericEvents>
  extends Logger,
    ComponentContext<Events>,
    StoreProviderContext,
    StoreUserContext {
  /**
   * An ID unique to this view.
   */
  readonly uid: string;

  /**
   * True while this view is connected to the DOM.
   */
  readonly isMounted: boolean;

  /**
   * Sets the name of the view's built in logger.
   */
  setName(name: string): ViewContext;

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
   * Watch a set of states. The callback is called when any of the states receive a new value.
   * Watchers will be automatically stopped when this view is unmounted.
   */
  watch<T extends MaybeState<any>[]>(states: [...T], callback: (...values: StateValues<T>) => void): StopFunction;

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
interface Context extends Logger {}

class Context implements ViewContext {
  __view;

  constructor(view: View<any>) {
    this.__view = view;

    // Copy logger methods from logger.
    const descriptors = Object.getOwnPropertyDescriptors(this.__view._logger);
    for (const key in descriptors) {
      if (key !== "setName") {
        Object.defineProperty(this, key, descriptors[key]);
      }
    }
  }

  get uid() {
    return this.__view.uniqueId;
  }

  get isMounted() {
    return this.__view.isMounted;
  }

  setName(name: string): ViewContext {
    this.__view._logger.setName(name);
    this.__view._elementContext.viewName = name;
    return this;
  }

  on(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = (_eventName: any, event: ContextEvent, ...args: any[]) => {
        listener(event, ...args);
      };
      this.__view._elementContext.emitter.on(type, wrappedListener);
      this.__view._wildcardListeners.set(listener, wrappedListener);
    } else {
      this.__view._elementContext.emitter.on(type, listener);
    }
  }

  off(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = this.__view._wildcardListeners.get(listener);
      if (wrappedListener) {
        this.__view._elementContext.emitter.off(type, wrappedListener);
        this.__view._wildcardListeners.delete(listener);
      }
    } else {
      this.__view._elementContext.emitter.off(type, listener);
    }
  }

  once(type: any, listener: (event: ContextEvent, ...args: any[]) => void): void {
    if (type === "*") {
      const wrappedListener = (_type: any, event: ContextEvent, ...args: any[]) => {
        this.__view._wildcardListeners.delete(listener);
        listener(event, ...args);
      };
      this.__view._elementContext.emitter.once(type, wrappedListener);
      this.__view._wildcardListeners.set(listener, wrappedListener);
    } else {
      this.__view._elementContext.emitter.once(type, listener);
    }
  }

  emit(type: any, ...args: any[]): boolean {
    return this.__view._elementContext.emitter.emit(type, new ContextEvent(type), ...args);
  }

  provide<Value>(store: StoreFunction<any, Value>, options?: any): Value {
    const instance = new Store(store, options);
    const attached = instance.attach(this.__view._elementContext);
    if (attached) {
      this.__view._emitter.on("mounted", () => {
        instance.handleMount();
      });
      this.__view._emitter.on("unmounted", () => {
        instance.handleUnmount();
      });
      return instance.value;
    } else {
      let name = store.name ? `'${store.name}'` : "this store";
      this.__view._logger.warn(`An instance of ${name} was already attached to this context.`);
      return this.use(store);
    }
  }

  use<Value>(store: StoreFunction<any, Value>): Value {
    if (isFunction(store)) {
      let context = this.__view._elementContext;
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
    this.__view._emitter.on("beforeMount", callback);
  }

  onMount(callback: () => void): void {
    this.__view._emitter.on("mounted", callback);
  }

  beforeUnmount(callback: () => void): void {
    this.__view._emitter.on("beforeUnmount", callback);
  }

  onUnmount(callback: () => void): void {
    this.__view._emitter.on("unmounted", callback);
  }

  watch<T extends MaybeState<any>[]>(states: [...T], callback: (...values: StateValues<T>) => void): StopFunction {
    const view = this.__view;

    if (view.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      return view._watcher.watch(states, callback);
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let stop: StopFunction | undefined;
      let isStopped = false;
      view._emitter.on("mounted", () => {
        if (!isStopped) {
          stop = view._watcher.watch(states, callback);
        }
      });
      return () => {
        if (stop != null) {
          isStopped = true;
          stop();
        }
      };
    }
  }

  effect(callback: EffectCallback) {
    const view = this.__view;

    // TODO: Set up effect in a more direct way? I'm just hacking compose here.

    if (view.isMounted) {
      // If called when the component is connected, we assume this code is in a lifecycle hook
      // where it will be triggered at some point again after the component is reconnected.
      const unsubscribe = compose<void>(callback).subscribe(noOp);
      this.__view._unsubscribes.push(unsubscribe);
      return unsubscribe;
    } else {
      // This should only happen if called in the body of the component function.
      // This code is not always re-run between when a component is unmounted and remounted.
      let unsubscribe: UnsubscribeFunction | undefined;
      let disposed = false;
      view._emitter.on("mounted", () => {
        if (!disposed) {
          unsubscribe = compose<void>(callback).subscribe(noOp);
          this.__view._unsubscribes.push(unsubscribe);
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
    return createMarkup("$outlet", { children: this.__view._children });
  }
}

type ViewEvents = {
  beforeMount: [];
  mounted: [];
  beforeUnmount: [];
  unmounted: [];
};

export class View<P> implements ViewElement {
  [IS_MARKUP_ELEMENT] = true;

  uniqueId = getUniqueId();

  _elementContext: ElementContext;
  _logger;
  _view;
  _props;

  _element?: MarkupElement;

  _childMarkup;

  _children = atom<MarkupElement[]>([]);

  _watcher = createWatcher();
  _unsubscribes: UnsubscribeFunction[] = [];
  _emitter = new Emitter<ViewEvents>();
  _wildcardListeners: WildcardListenerMap = new Map();

  constructor(elementContext: ElementContext, view: ViewFunction<P>, props: P, children: Markup[] = []) {
    this._elementContext = {
      ...elementContext,
      data: {},
      parent: elementContext,
      viewName: view.name,
      emitter: new Emitter(),
      stores: new Map(),
    };
    this._logger = elementContext.root.createLogger(view.name || "🌇 anonymous view", { uid: this.uniqueId });
    this._view = view;
    this._props = props;

    this._childMarkup = children;

    this._emitter.on("error", (error, type, ...args) => {
      console.error([error, type, ...args]);
      this._logger.error((error as Error).message, { error, type, args });
      this._logger.crash(error as Error);
    });

    // Bubble events by emitting them to parent.
    this._elementContext.emitter.on("*", (type, event, ...args) => {
      if (event instanceof ContextEvent) {
        if (!event.isStopped) {
          this._elementContext.parent?.emitter.emit(type, event, ...args);
        }
      }
    });
  }

  /*===============================*\
  ||         "Public" API          ||
  \*===============================*/

  get node() {
    return this._element?.node!;
  }

  isMounted = false;

  mount(parent: Node, after?: Node) {
    // Don't run lifecycle hooks or initialize if already connected.
    // Calling connect again can be used to re-order elements that are already connected to the DOM.
    const wasConnected = this.isMounted;

    if (!wasConnected) {
      this._initialize();
      this._emitter.emit("beforeMount");
    }

    if (this._element) {
      this._element.mount(parent, after);
    }

    if (!wasConnected) {
      this.isMounted = true;

      _onViewMounted();

      // TODO: Figure out why rAF is needed for updates to DOM nodes to work in onMount callbacks.
      requestAnimationFrame(() => {
        this._emitter.emit("mounted");
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    this._emitter.emit("beforeUnmount");

    if (this._element) {
      // parentIsUnmounting is forwarded to the element because the view acts as a proxy for an element.
      this._element.unmount(parentIsUnmounting);
    }

    if (this.isMounted) {
      _onViewUnmounted();
    }

    this.isMounted = false;

    this._emitter.emit("unmounted");
    this._emitter.clear();

    // Clear elementContext's emitter as well? That was created in this constructor, so garbage collection should get it.

    for (const unsubscribe of this._unsubscribes) {
      unsubscribe();
    }
    this._unsubscribes.length = 0;

    // TODO: Deprecated
    this._watcher.stopAll();
  }

  setChildView(fn: ViewFunction<{}>) {
    this._childMarkup = [];
    const node = new View(this._elementContext, fn, {});
    this._children.value = [node];
    return node;
  }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  private _initialize() {
    const context = new Context(this);

    let result: ViewResult;
    try {
      result = this._view.call(context, this._props, context);

      if (this._childMarkup.length) {
        this._children.value = constructMarkup(this._elementContext, this._childMarkup);
      }
    } catch (error) {
      if (error instanceof Error) {
        this._logger.crash(error);
      }
      throw error;
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      this._element = groupElements(constructMarkup(this._elementContext, createMarkup("$node", { value: result })));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      this._element = groupElements(constructMarkup(this._elementContext, result));
    } else if (isState(result)) {
      this._element = groupElements(
        constructMarkup(this._elementContext, createMarkup("$observer", { sources: [result], renderFn: (x) => x })),
      );
    } else {
      const error = new TypeError(
        `Expected '${
          this._view.name
        }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`,
      );
      this._logger.crash(error);
    }
  }
}
