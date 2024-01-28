import { isArrayOf, typeOf } from "./typeChecking.js";
import { nanoid } from "nanoid";
import { type AppContext, type ElementContext } from "./app.js";
import { type DebugChannel } from "./classes/DebugHub.js";
import { getRenderHandle, isMarkup, m, renderMarkupToDOM, type DOMHandle, type Markup } from "./markup.js";
import { $, $$, isReadable, observe, type Readable, type ReadableValues, type MaybeReadable } from "./state.js";
import { type Store } from "./store.js";
import type { BuiltInStores } from "./types.js";

/*=====================================*\
||                Types                ||
\*=====================================*/

/**
 * Any valid value that a View can return.
 */
export type ViewResult = Node | Readable<any> | Markup | Markup[] | null;

export type View<P> = (props: P, context: ViewContext) => ViewResult;

export interface ViewContext extends DebugChannel {
  /**
   * A string ID unique to this view.
   */
  readonly uniqueId: string;

  /**
   * Returns the shared instance of `store`.
   */
  getStore<T extends Store<any, any>>(store: T): ReturnType<T>;

  /**
   * Returns the shared instance of a built-in store.
   */
  getStore<N extends keyof BuiltInStores>(name: N): BuiltInStores[N];

  /**
   * Runs `callback` just before this view is connected. DOM nodes are not yet attached to the page.
   */
  beforeConnect(callback: () => void): void;

  /**
   * Runs `callback` after this view is connected. DOM nodes are now attached to the page.
   */
  onConnected(callback: () => void): void;

  /**
   * Runs `callback` just before this view is disconnected. DOM nodes are still attached to the page.
   */
  beforeDisconnect(callback: () => void): void;

  /**
   * Runs `callback` after this view is disconnected. DOM nodes are no longer attached to the page.
   */
  onDisconnected(callback: () => void): void;

  /**
   * The name of this view for logging and debugging purposes.
   */
  name: string;

  /**
   * Takes an Error object, unmounts the app and displays its crash page.
   */
  crash(error: Error): void;

  /**
   * Observes a readable value while this view is connected. Calls `callback` each time the value changes.
   */
  observe<T>(state: MaybeReadable<T>, callback: (currentValue: T) => void): void;

  /**
   * Observes a set of readable values while this view is connected.
   * Calls `callback` with each value in the same order as `readables` each time any of their values change.
   */
  observe<T extends MaybeReadable<any>[]>(
    states: [...T],
    callback: (...currentValues: ReadableValues<T>) => void
  ): void;

  observe<I1, I2>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    callback: (value1: I1, value2: I2) => void
  ): void;

  observe<I1, I2, I3>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    callback: (value1: I1, value2: I2, value3: I3) => void
  ): void;

  observe<I1, I2, I3, I4>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4) => void
  ): void;

  observe<I1, I2, I3, I4, I5>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    callback: (value1: I1, value2: I2, value3: I3, value4: I4, value5: I5, value6: I6, value7: I7, value8: I8) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8, I9>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    state9: MaybeReadable<I9>,
    callback: (
      value1: I1,
      value2: I2,
      value3: I3,
      value4: I4,
      value5: I5,
      value6: I6,
      value7: I7,
      value8: I8,
      value9: I9
    ) => void
  ): void;

  observe<I1, I2, I3, I4, I5, I6, I7, I8, I9, I10>(
    state1: MaybeReadable<I1>,
    state2: MaybeReadable<I2>,
    state3: MaybeReadable<I3>,
    state4: MaybeReadable<I4>,
    state5: MaybeReadable<I5>,
    state6: MaybeReadable<I6>,
    state7: MaybeReadable<I7>,
    state8: MaybeReadable<I8>,
    state9: MaybeReadable<I9>,
    state10: MaybeReadable<I10>,
    callback: (
      value1: I1,
      value2: I2,
      value3: I3,
      value4: I4,
      value5: I5,
      value6: I6,
      value7: I7,
      value8: I8,
      value9: I9,
      value10: I10
    ) => void
  ): void;

  /**
   * Returns a Markup element that displays this view's children.
   */
  outlet(): Markup;
}

/*=====================================*\
||          Context Accessors          ||
\*=====================================*/

export interface ViewContextSecrets {
  appContext: AppContext;
  elementContext: ElementContext;
}

const SECRETS = Symbol("VIEW_SECRETS");

export function getViewSecrets(ctx: ViewContext): ViewContextSecrets {
  return (ctx as any)[SECRETS];
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
  appContext: AppContext;
  elementContext: ElementContext;
  props: P;
  children?: Markup[];
}

export function initView<P>(config: ViewConfig<P>): DOMHandle {
  const appContext = config.appContext;
  const elementContext = {
    ...config.elementContext,
    stores: new Map(),
    parent: config.elementContext,
  };
  const $$children = $$<DOMHandle[]>(renderMarkupToDOM(config.children ?? [], { appContext, elementContext }));

  let isConnected = false;

  // Lifecycle and observers
  const stopObserverCallbacks: (() => void)[] = [];
  const connectedCallbacks: (() => any)[] = [];
  const disconnectedCallbacks: (() => any)[] = [];
  const beforeConnectCallbacks: (() => void | Promise<void>)[] = [];
  const beforeDisconnectCallbacks: (() => void | Promise<void>)[] = [];

  const uniqueId = nanoid();

  const ctx: Omit<ViewContext, keyof DebugChannel> = {
    get uniqueId() {
      return uniqueId;
    },

    name: config.view.name ?? "anonymous",

    getStore(store: keyof BuiltInStores | Store<any, any>) {
      let name: string;

      if (typeof store === "string") {
        name = store as keyof BuiltInStores;
      } else {
        name = store.name;
      }

      if (typeof store !== "string") {
        let ec: ElementContext | undefined = elementContext;
        while (ec) {
          if (ec.stores.has(store)) {
            return ec.stores.get(store)?.instance!.exports;
          }
          ec = ec.parent;
        }
      }

      if (appContext.stores.has(store)) {
        const _store = appContext.stores.get(store)!;

        if (!_store.instance) {
          appContext.crashCollector.crash({
            componentName: ctx.name,
            error: new Error(`Store '${name}' is not registered on this app.`),
          });
        }

        return _store.instance!.exports;
      }

      appContext.crashCollector.crash({
        componentName: ctx.name,
        error: new Error(`Store '${name}' is not registered on this app.`),
      });
    },

    onConnected(callback) {
      connectedCallbacks.push(callback);
    },

    onDisconnected(callback) {
      disconnectedCallbacks.push(callback);
    },

    beforeConnect(callback) {
      beforeConnectCallbacks.push(callback);
    },

    beforeDisconnect(callback) {
      beforeDisconnectCallbacks.push(callback);
    },

    crash(error: Error) {
      config.appContext.crashCollector.crash({ error, componentName: ctx.name });
    },

    observe(...args: any[]) {
      const callback = args.pop();
      if (isConnected) {
        // If called when the component is connected, we assume this code is in a lifecycle hook
        // where it will be triggered at some point again after the component is reconnected.
        const stop = observe(args, callback);
        stopObserverCallbacks.push(stop);
      } else {
        // This should only happen if called in the body of the component function.
        // This code is not always re-run between when a component is disconnected and reconnected.
        connectedCallbacks.push(() => {
          const stop = observe(args, callback);
          stopObserverCallbacks.push(stop);
        });
      }
    },

    outlet() {
      return m("$outlet", { $children: $($$children) });
    },
  };

  const debugChannel = appContext.debugHub.channel({
    get name() {
      return ctx.name;
    },
  });

  Object.defineProperties(ctx, Object.getOwnPropertyDescriptors(debugChannel));

  Object.defineProperty(ctx, SECRETS, {
    enumerable: false,
    configurable: false,
    value: {
      appContext,
      elementContext,
    } as ViewContextSecrets,
  });

  let rendered: DOMHandle | undefined;

  function initialize() {
    let result: unknown;

    try {
      result = config.view(config.props, ctx as ViewContext);
    } catch (error) {
      if (error instanceof Error) {
        appContext.crashCollector.crash({ error, componentName: ctx.name });
      }
      throw error;
    }

    if (result instanceof Promise) {
      appContext.crashCollector.crash({
        error: new TypeError(`View function cannot return a Promise.`),
        componentName: ctx.name,
      });
    }

    if (result === null) {
      // Do nothing.
    } else if (result instanceof Node) {
      rendered = getRenderHandle(renderMarkupToDOM(m("$node", { value: result }), { appContext, elementContext }));
    } else if (isMarkup(result) || isArrayOf<Markup>(isMarkup, result)) {
      rendered = getRenderHandle(renderMarkupToDOM(result, { appContext, elementContext }));
    } else if (isReadable(result)) {
      rendered = getRenderHandle(
        renderMarkupToDOM(m("$observer", { readables: [result], renderFn: (x) => x }), { appContext, elementContext })
      );
    } else {
      console.warn(result, config);
      appContext.crashCollector.crash({
        error: new TypeError(
          `Expected '${
            config.view.name
          }' function to return a DOM node, Markup element, Readable or null. Got: ${typeOf(result)}`
        ),
        componentName: ctx.name,
      });
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
      $$children.set(children);
    },
  };

  return handle;
}
