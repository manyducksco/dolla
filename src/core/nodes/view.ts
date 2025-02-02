import { isArrayOf, typeOf } from "../../typeChecking.js";
import { getUniqueId } from "../../utils.js";
import type { Logger } from "../dolla.js";
import {
  constructMarkup,
  createMarkup,
  type ElementContext,
  groupElements,
  isMarkup,
  type Markup,
  type MarkupElement,
} from "../markup.js";
import {
  createState,
  createWatcher,
  isState,
  type MaybeState,
  type State,
  type StateValues,
  type StopFunction,
} from "../state.js";
import { TYPE_MARKUP_ELEMENT } from "../symbols.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | State<any> | Markup | Markup[] | null;

export type ViewFunction<P> = (props: P, context: ViewContext) => ViewResult;

/**
 * A view that has been constructed into DOM nodes.
 */
export interface ViewElement extends MarkupElement {
  /**
   * Take a ViewFunction and render it as a child of this view.
   */
  setChildView(view: ViewFunction<{}>): ViewElement;
}

export interface ViewContext extends Logger {
  /**
   * An ID unique to this view.
   */
  readonly uid: string;

  /**
   * Sets a context variable and returns its value. Context variables are accessible on the same context and from those of child views.
   */
  set<T>(key: string | symbol, value: T): T;

  /**
   * Gets the value of a context variable. Returns null if the variable is not set.
   */
  get<T>(key: string | symbol): T | null;

  /**
   * Returns an object of all variables stored on this context.
   */
  getAll(): Record<string | symbol, unknown>;

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
   * Returns a Markup element that displays this view's children.
   */
  outlet(): Markup;
}

/*=====================================*\
||              View Init              ||
\*=====================================*/

// Defines logger methods on context.
interface Context extends Logger {}

class Context implements ViewContext {
  __view;

  constructor(view: View<any>) {
    this.__view = view;

    // Copy logger methods from logger.
    const descriptors = Object.getOwnPropertyDescriptors(this.__view._logger);
    for (const key in descriptors) {
      if (key !== "getName") {
        Object.defineProperty(this, key, descriptors[key]);
      }
    }
  }

  get uid() {
    return this.__view.uniqueId;
  }

  setName(name: string): ViewContext {
    this.__view._logger.setName(name);
    return this;
  }

  set<T>(key: string | symbol, value: T): T {
    this.__view._elementContext.data[key] = value;
    return value;
  }

  get<T>(key: string | symbol): T | null {
    let ctx = this.__view._elementContext;

    while (true) {
      if (key in ctx.data) {
        return ctx.data[key] as T;
      } else if (ctx.parent) {
        ctx = ctx.parent;
      } else {
        break;
      }
    }

    return null;
  }

  getAll(): Record<string | symbol, unknown> {
    const contexts: Record<string | symbol, unknown>[] = [];

    let ctx = this.__view._elementContext;
    while (true) {
      contexts.push(ctx.data);

      if (ctx.parent) {
        ctx = ctx.parent;
      } else {
        break;
      }
    }

    const data: Record<string | symbol, unknown> = {};

    // Iterate data objects in top -> bottom order.
    for (const context of contexts.reverse()) {
      Object.assign(data, context);
    }

    return data;
  }

  beforeMount(callback: () => void): void {
    this.__view._beforeMountCallbacks.push(callback);
  }

  onMount(callback: () => void): void {
    this.__view._onMountCallbacks.push(callback);
  }

  beforeUnmount(callback: () => void): void {
    this.__view._beforeUnmountCallbacks.push(callback);
  }

  onUnmount(callback: () => void): void {
    this.__view._onUnmountCallbacks.push(callback);
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
      view._onMountCallbacks.push(() => {
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

  outlet(): Markup {
    return createMarkup("$outlet", { $children: this.__view._$children });
  }
}

export class View<P> implements ViewElement {
  [TYPE_MARKUP_ELEMENT] = true;

  uniqueId = getUniqueId();

  _elementContext: ElementContext;
  _logger;
  _view;
  _props;

  _element?: MarkupElement;

  _childMarkup;

  _$children;
  _setChildren;

  _watcher = createWatcher();
  _beforeMountCallbacks: (() => any)[] = [];
  _onMountCallbacks: (() => any)[] = [];
  _beforeUnmountCallbacks: (() => any)[] = [];
  _onUnmountCallbacks: (() => any)[] = [];

  constructor(elementContext: ElementContext, view: ViewFunction<P>, props: P, children: Markup[] = []) {
    this._elementContext = { ...elementContext, data: {}, parent: elementContext };
    this._logger = elementContext.root.createLogger(view.name, { uid: this.uniqueId });
    this._view = view;
    this._props = props;

    this._childMarkup = children;
    [this._$children, this._setChildren] = createState<MarkupElement[]>([]);
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
      this.initialize();
      while (this._beforeMountCallbacks.length > 0) {
        const callback = this._beforeMountCallbacks.shift()!;
        callback();
      }
    }

    if (this._element) {
      this._element.mount(parent, after);
    }

    if (!wasConnected) {
      this.isMounted = true;

      requestAnimationFrame(() => {
        while (this._onMountCallbacks.length > 0) {
          const callback = this._onMountCallbacks.shift()!;
          callback();
        }
      });
    }
  }

  unmount(parentIsUnmounting = false) {
    while (this._beforeUnmountCallbacks.length > 0) {
      const callback = this._beforeUnmountCallbacks.shift()!;
      callback();
    }

    if (this._element) {
      // parentIsUnmounting is forwarded to the element because the view acts as a proxy for an element.
      this._element.unmount(parentIsUnmounting);
    }

    this.isMounted = false;

    while (this._onUnmountCallbacks.length > 0) {
      const callback = this._onUnmountCallbacks.shift()!;
      callback();
    }

    this._watcher.stopAll();
  }

  setChildView(fn: ViewFunction<{}>) {
    this._childMarkup = [];
    const node = new View(this._elementContext, fn, {});
    this._setChildren([node]);
    return node;
  }

  /*===============================*\
  ||           Internal            ||
  \*===============================*/

  initialize() {
    const context = new Context(this);

    let result: ViewResult;
    try {
      if (this._childMarkup.length) {
        this._setChildren(constructMarkup(this._elementContext, this._childMarkup));
      }

      result = this._view(this._props, context);
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
