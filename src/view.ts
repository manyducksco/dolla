import { nanoid } from "nanoid";
import {
  type DOMHandle,
  type ElementContext,
  getRenderHandle,
  isMarkup,
  m,
  type Markup,
  renderMarkupToDOM,
} from "./markup.js";
import { _CRASH } from "./modules/logging.js";
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

export type View<P> = (props: P, context: ViewContext) => ViewResult;

export interface ViewContext {
  /**
   * A string ID unique to this view.
   */
  readonly uid: string;

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

export function view<P>(callback: View<P>) {
  return callback;
}

/**
 * Parameters passed to the makeView function.
 */
interface ViewConfig<P> {
  view: View<P>;
  elementContext?: ElementContext;
  props: P;
  children?: Markup[];
}

export function initView<P>(config: ViewConfig<P>): DOMHandle {
  const elementContext = {
    ...(config.elementContext ?? {}),
    parent: config.elementContext,
  };
  const [$children, setChildren] = createSignal<DOMHandle[]>(renderMarkupToDOM(config.children ?? [], elementContext));

  let isConnected = false;

  // Lifecycle and observers
  const stopObserverCallbacks: (() => void)[] = [];
  const connectedCallbacks: (() => any)[] = [];
  const disconnectedCallbacks: (() => any)[] = [];
  const beforeConnectCallbacks: (() => void | Promise<void>)[] = [];
  const beforeDisconnectCallbacks: (() => void | Promise<void>)[] = [];

  const uniqueId = nanoid();

  const ctx: ViewContext = {
    get uid() {
      return uniqueId;
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
      return m("$outlet", { $children });
    },
  };

  let rendered: DOMHandle | undefined;

  function initialize() {
    let result: unknown;

    try {
      result = config.view(config.props, ctx as ViewContext);
    } catch (error) {
      if (error instanceof Error) {
        _CRASH({ error, loggerName: "dolla/view", uid: ctx.uid });
      }
      throw error;
    }

    if (result instanceof Promise) {
      throw new TypeError(`View function cannot return a Promise.`);
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      rendered = getRenderHandle(renderMarkupToDOM(m("$node", { value: result }), elementContext));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      rendered = getRenderHandle(renderMarkupToDOM(result, elementContext));
    } else if (isSignal(result)) {
      rendered = getRenderHandle(
        renderMarkupToDOM(m("$observer", { signals: [result], renderFn: (x) => x }), elementContext),
      );
    } else {
      // console.warn(result, config);
      const error = new TypeError(
        `Expected '${
          config.view.name
        }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`,
      );
      _CRASH({ error, loggerName: "dolla/view", uid: ctx.uid });
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
