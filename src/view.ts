import { nanoid } from "nanoid";
import {
  type DOMHandle,
  type ElementContext,
  getRenderHandle,
  isMarkup,
  createMarkup,
  type Markup,
  renderMarkupToDOM,
} from "./markup.js";
import type { Logger } from "./modules/dolla.js";
import {
  createSignal,
  isSignal,
  type MaybeSignal,
  Signal,
  type SignalValues,
  type StopFunction,
  watch,
} from "./signals.js";
import { isArrayOf, typeOf } from "./typeChecking.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Signal<any> | Markup | Markup[] | null;

export type ViewFunction<P> = (props: P, context: ViewContext) => ViewResult;

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
   * Watch a set of signals. The callback is called when any of the signals receive a new value.
   * Watchers will be stopped when this view is unmounted. Returns a function to stop watching early.
   */
  watch<T extends MaybeSignal<any>[]>(signals: [...T], callback: (...values: SignalValues<T>) => void): StopFunction;

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
): DOMHandle {
  elementContext = { ...elementContext };
  const [$children, setChildren] = createSignal<DOMHandle[]>(renderMarkupToDOM(children, elementContext));

  let isConnected = false;

  // Lifecycle and observers
  const stopObserverCallbacks: (() => void)[] = [];
  const connectedCallbacks: (() => any)[] = [];
  const disconnectedCallbacks: (() => any)[] = [];
  const beforeConnectCallbacks: (() => void | Promise<void>)[] = [];
  const beforeDisconnectCallbacks: (() => void | Promise<void>)[] = [];

  const uniqueId = nanoid();

  const [$loggerName, setLoggerName] = createSignal(view.name);
  const logger = elementContext.root.createLogger($loggerName, { uid: uniqueId });

  const ctx: Pick<ViewContext, Exclude<keyof ViewContext, keyof Logger>> = {
    get uid() {
      return uniqueId;
    },

    setName(name) {
      setLoggerName(name);
    },

    beforeMount(callback) {
      beforeConnectCallbacks.push(callback);
    },

    onMount(callback) {
      connectedCallbacks.push(callback);
    },

    beforeUnmount(callback) {
      beforeDisconnectCallbacks.push(callback);
    },

    onUnmount(callback) {
      disconnectedCallbacks.push(callback);
    },

    watch(signals, callback) {
      if (isConnected) {
        // If called when the component is connected, we assume this code is in a lifecycle hook
        // where it will be triggered at some point again after the component is reconnected.
        const stop = watch(signals, callback);
        stopObserverCallbacks.push(stop);
        return stop;
      } else {
        // This should only happen if called in the body of the component function.
        // This code is not always re-run between when a component is disconnected and reconnected.
        let stop: StopFunction | undefined;
        let stopped = false;
        connectedCallbacks.push(() => {
          if (!stopped) {
            stop = watch(signals, callback);
            stopObserverCallbacks.push(stop);
          }
        });
        return function stop() {
          if (stop != null) {
            stopped = true;
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

  let rendered: DOMHandle | undefined;

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
      rendered = getRenderHandle(renderMarkupToDOM(createMarkup("$node", { value: result }), elementContext));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      rendered = getRenderHandle(renderMarkupToDOM(result, elementContext));
    } else if (isSignal(result)) {
      rendered = getRenderHandle(
        renderMarkupToDOM(createMarkup("$observer", { signals: [result], renderFn: (x) => x }), elementContext),
      );
    } else {
      // console.warn(result, config);
      const error = new TypeError(
        `Expected '${
          view.name
        }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`,
      );
      logger.crash(error);
    }
  }

  const handle: DOMHandle = {
    get node() {
      return rendered?.node!;
    },

    get connected() {
      return isConnected;
    },

    connect(parent: Node, after?: Node) {
      // Don't run lifecycle hooks or initialize if already connected.
      // Calling connect again can be used to re-order elements that are already connected to the DOM.
      const wasConnected = isConnected;

      if (!wasConnected) {
        initialize();
        while (beforeConnectCallbacks.length > 0) {
          const callback = beforeConnectCallbacks.shift()!;
          callback();
        }
      }

      if (rendered) {
        rendered.connect(parent, after);
      }

      if (!wasConnected) {
        isConnected = true;

        requestAnimationFrame(() => {
          while (connectedCallbacks.length > 0) {
            const callback = connectedCallbacks.shift()!;
            callback();
          }
        });
      }
    },

    disconnect() {
      while (beforeDisconnectCallbacks.length > 0) {
        const callback = beforeDisconnectCallbacks.shift()!;
        callback();
      }

      if (rendered) {
        rendered.disconnect();
      }

      isConnected = false;

      while (disconnectedCallbacks.length > 0) {
        const callback = disconnectedCallbacks.shift()!;
        callback();
      }

      while (stopObserverCallbacks.length > 0) {
        const callback = stopObserverCallbacks.shift()!;
        callback();
      }
    },

    async setChildren(children) {
      setChildren(children);
    },
  };

  return handle;
}
