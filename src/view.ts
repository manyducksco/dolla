import { nanoid } from "nanoid";
import {
  type MarkupNode,
  type ElementContext,
  mergeNodes,
  isMarkup,
  createMarkup,
  type Markup,
  constructMarkup,
} from "./markup.js";
import type { Logger } from "./modules/dolla.js";
import { createState, isState, type MaybeState, State, type StateValues, type StopFunction, watch } from "./state.js";
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
export interface ViewNode extends MarkupNode {
  setChildren(children: MarkupNode[]): void;
}

export interface ViewContext extends Logger {
  /**
   * A string ID unique to this view.
   */
  readonly uid: string;

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
): ViewNode {
  elementContext = { ...elementContext };
  const [$children, setChildren] = createState<MarkupNode[]>(constructMarkup(elementContext, children));

  let isMounted = false;

  // Lifecycle and observers
  const stopObserverCallbacks: (() => void)[] = [];
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
        const stop = watch(states, callback);
        stopObserverCallbacks.push(stop);
        return stop;
      } else {
        // This should only happen if called in the body of the component function.
        // This code is not always re-run between when a component is unmounted and remounted.
        let stop: StopFunction | undefined;
        let isStopped = false;
        onMountCallbacks.push(() => {
          if (!isStopped) {
            stop = watch(states, callback);
            stopObserverCallbacks.push(stop);
          }
        });
        return function stop() {
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

  let rendered: MarkupNode | undefined;

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
      rendered = mergeNodes(constructMarkup(elementContext, createMarkup("$node", { value: result })));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      rendered = mergeNodes(constructMarkup(elementContext, result));
    } else if (isState(result)) {
      rendered = mergeNodes(
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

      while (stopObserverCallbacks.length > 0) {
        const callback = stopObserverCallbacks.shift()!;
        callback();
      }
    },

    setChildren(children) {
      setChildren(children);
    },
  };
}
