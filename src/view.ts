import { nanoid } from "nanoid";
import {
  type MarkupElement,
  type ElementContext,
  mergeElements,
  isMarkup,
  createMarkup,
  type Markup,
  constructMarkup,
} from "./markup.js";
import type { Logger } from "./modules/dolla.js";
import {
  createState,
  createWatcher,
  isState,
  type MaybeState,
  State,
  type StateValues,
  type StopFunction,
} from "./state.js";
import { isArrayOf, typeOf } from "./typeChecking.js";

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
   * A string ID unique to this view.
   */
  readonly uid: string;

  /**
   * Sets a context variable. Context variables are accessible on the same context and from those of child views.
   */
  set<T>(key: string | symbol, value: T): void;

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
  setName(name: string): void;

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

export function constructView<P>(
  elementContext: ElementContext,
  view: ViewFunction<P>,
  props: P,
  children: Markup[] = [],
): ViewElement {
  elementContext = { ...elementContext, data: {}, parent: elementContext };
  const [$children, setChildren] = createState<MarkupElement[]>(constructMarkup(elementContext, children));

  let isMounted = false;

  const watcher = createWatcher();

  // Lifecycle and observers
  // const stopObserverCallbacks: (() => void)[] = [];
  const beforeMountCallbacks: (() => void | Promise<void>)[] = [];
  const onMountCallbacks: (() => any)[] = [];
  const beforeUnmountCallbacks: (() => void | Promise<void>)[] = [];
  const onUnmountCallbacks: (() => any)[] = [];

  const uniqueId = nanoid();

  const [$name, setName] = createState(view.name);
  const logger = elementContext.root.createLogger($name, { uid: uniqueId });

  const ctx: Pick<ViewContext, Exclude<keyof ViewContext, keyof Logger>> = {
    get uid() {
      return uniqueId;
    },

    set(key, value) {
      elementContext.data[key] = value;
    },

    get<T>(key: string | symbol) {
      let ctx = elementContext;

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
    },

    getAll() {
      const contexts: Record<string | symbol, unknown>[] = [];

      let ctx = elementContext;
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
    },

    setName(name) {
      setName(name);
    },

    beforeMount(callback) {
      beforeMountCallbacks.push(callback);
    },

    onMount(callback) {
      onMountCallbacks.push(callback);
    },

    beforeUnmount(callback) {
      beforeUnmountCallbacks.push(callback);
    },

    onUnmount(callback) {
      onUnmountCallbacks.push(callback);
    },

    watch(states, callback) {
      if (isMounted) {
        // If called when the component is connected, we assume this code is in a lifecycle hook
        // where it will be triggered at some point again after the component is reconnected.
        return watcher.watch(states, callback);
      } else {
        // This should only happen if called in the body of the component function.
        // This code is not always re-run between when a component is unmounted and remounted.
        let stop: StopFunction | undefined;
        let isStopped = false;
        onMountCallbacks.push(() => {
          if (!isStopped) {
            stop = watcher.watch(states, callback);
          }
        });
        return () => {
          if (stop != null) {
            isStopped = true;
            stop();
          }
        };
      }
    },

    outlet() {
      return createMarkup("$outlet", { $children });
    },
  };

  Object.assign(ctx, logger);

  let rendered: MarkupElement | undefined;

  function initialize() {
    let result: unknown;

    try {
      result = view(props, ctx as ViewContext);
    } catch (error) {
      if (error instanceof Error) {
        logger.crash(error);
      }
      throw error;
    }

    if (result instanceof Promise) {
      throw new TypeError(`View function cannot return a Promise.`);
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      rendered = mergeElements(constructMarkup(elementContext, createMarkup("$node", { value: result })));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      rendered = mergeElements(constructMarkup(elementContext, result));
    } else if (isState(result)) {
      rendered = mergeElements(
        constructMarkup(elementContext, createMarkup("$observer", { states: [result], renderFn: (x) => x })),
      );
    } else {
      const error = new TypeError(
        `Expected '${
          view.name
        }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`,
      );
      logger.crash(error);
    }
  }

  return {
    get node() {
      return rendered?.node!;
    },

    get isMounted() {
      return isMounted;
    },

    mount(parent: Node, after?: Node) {
      // Don't run lifecycle hooks or initialize if already connected.
      // Calling connect again can be used to re-order elements that are already connected to the DOM.
      const wasConnected = isMounted;

      if (!wasConnected) {
        initialize();
        while (beforeMountCallbacks.length > 0) {
          const callback = beforeMountCallbacks.shift()!;
          callback();
        }
      }

      if (rendered) {
        rendered.mount(parent, after);
      }

      if (!wasConnected) {
        isMounted = true;

        requestAnimationFrame(() => {
          while (onMountCallbacks.length > 0) {
            const callback = onMountCallbacks.shift()!;
            callback();
          }
        });
      }
    },

    unmount() {
      while (beforeUnmountCallbacks.length > 0) {
        const callback = beforeUnmountCallbacks.shift()!;
        callback();
      }

      if (rendered) {
        rendered.unmount();
      }

      isMounted = false;

      while (onUnmountCallbacks.length > 0) {
        const callback = onUnmountCallbacks.shift()!;
        callback();
      }

      watcher.stopAll();
    },

    setChildView(view) {
      const node = constructView(elementContext, view, {});
      setChildren([node]);
      return node;
    },
  };
}
