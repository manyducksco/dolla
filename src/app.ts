import { CrashCollector } from "./classes/CrashCollector.js";
import { DebugHub, type DebugOptions } from "./classes/DebugHub.js";
import { DOMHandle, m } from "./markup.js";
import { initStore, type Store } from "./store.js";
import { DocumentStore } from "./stores/document.js";
import { RenderStore } from "./stores/render.js";
import { assertFunction, assertInstanceOf, isObject, isString } from "./typeChecking.js";
import { type BuiltInStores } from "./types.js";
import { merge } from "./utils.js";
import { initView, type View, type ViewContext } from "./view.js";

// ----- Types ----- //

interface StoreConfig<O, E> {
  store: Store<O, E>;
  options?: O;
}

interface IAppOptions {
  /**
   * Options for the debug system.
   */
  debug?: DebugOptions;

  /**
   * The view to be rendered by the app.
   */
  view?: View<{}>;

  /**
   * App-level stores.
   */
  stores?: StoreConfig<any, any>[];

  /**
   * Configures the app based on the environment it's running in.
   */
  mode?: "development" | "production";
}

export interface AppContext {
  crashCollector: CrashCollector;
  debugHub: DebugHub;
  stores: Map<keyof BuiltInStores | StoreRegistration["store"], StoreRegistration>;
  mode: "development" | "production";
  rootElement?: HTMLElement;
  rootView?: DOMHandle;
}

export interface ElementContext {
  stores: Map<StoreRegistration["store"], StoreRegistration>;
  isSVG?: boolean;
  componentName?: string; // name of the nearest parent component
  parent?: ElementContext;
}

/**
 * An object kept in App for each store registered with `addStore`.
 */
export interface StoreRegistration<O = any> {
  store: Store<O, any>;
  options?: O;
  instance?: ReturnType<typeof initStore>;
}

interface ConfigureContext {
  // use
}

type ConfigureCallback = (ctx: ConfigureContext) => void | Promise<void>;

export interface IApp {
  readonly isConnected: boolean;

  /**
   * Makes this store accessible from any other component in the app, except for stores registered before this one.
   */
  // addStore<O>(store: Store<O, any>, options?: O): this;

  /**
   * Runs `callback` after app-level stores are connected to the app, but before views are connected to the DOM.
   * Use this function to run async configuration code before displaying content to the user.
   *
   * Note that this will delay content being displayed on the screen, so using some kind of splash screen is recommended.
   */
  configure(callback: ConfigureCallback): this;

  /**
   * Initializes and connects the app as a child of `element`.
   *
   * @param element - A selector string or a DOM node to attach to. If a string, follows the same format as that taken by `document.querySelector`.
   */
  connect(selector: string | Node): Promise<void>;

  /**
   * Disconnects views and tears down globals, removing the app from the page.
   */
  disconnect(): Promise<void>;
}

// ----- Code ----- //

/**
 * The default root view. This is used when no root view is provided to the app.
 * It does nothing but render routes.
 */

function DefaultRootView(_: {}, ctx: ViewContext) {
  return ctx.outlet();
}

function isAppOptions(value: unknown): value is IAppOptions {
  return isObject(value);
}

export function App(options?: IAppOptions): IApp {
  if (options && !isAppOptions(options)) {
    throw new TypeError(`App options must be an object. Got: ${options}`);
  }

  let isConnected = false;
  let mainView = m(options?.view ?? DefaultRootView);
  let configureCallback: ConfigureCallback | undefined;

  const settings: IAppOptions = merge(
    {
      debug: {
        filter: "*,-dolla/*",
        log: "development", // Only print logs in development.
        warn: "development", // Only print warnings in development.
        error: true, // Always print errors.
      },
      mode: "production",
    },
    options ?? {}
  );

  const stores = new Map<keyof BuiltInStores | Store<any, any>, StoreRegistration>([
    ["render", { store: RenderStore }],
    ["document", { store: DocumentStore }],
  ]);

  if (options?.stores) {
    for (const entry of options.stores) {
      assertFunction(entry.store, `Expected a store function. Got type: %t, value: %v`);
      stores.set(entry.store, entry);
    }
  }

  /*=============================*\
  ||   Logging & Error Handling  ||
  \*=============================*/

  // Crash collector is used by components to handle crashes and errors.
  const crashCollector = new CrashCollector();
  const debugHub = new DebugHub({ ...settings.debug, crashCollector, mode: settings.mode! });
  const debugChannel = debugHub.channel({ name: "dolla/App" });

  // When an error of "crash" severity is reported by a component,
  // the app is disconnected and a crash page is connected.
  crashCollector.onError(async ({ error, severity, componentName }) => {
    // Disconnect app and connect crash page on "crash" severity.
    if (severity === "crash") {
      await disconnect();

      const instance = initView({
        view: DefaultCrashPage,
        appContext,
        elementContext,
        props: {
          message: error.message,
          error: error,
          componentName,
        },
      });

      instance.connect(appContext.rootElement!);
    }
  });

  /*=============================*\
  ||        App Lifecycle        ||
  \*=============================*/

  // let stopCallbacks: StopFunction[] = [];

  async function connect(selector: string | Node) {
    return new Promise<void>(async (resolve) => {
      let element: HTMLElement | null = null;

      if (isString(selector)) {
        element = document.querySelector(selector);
        assertInstanceOf(HTMLElement, element, `Selector string '${selector}' did not match any element.`);
      }

      assertInstanceOf(HTMLElement, element, "Expected a DOM node or a selector string. Got type: %t, value: %v");

      appContext.rootElement = element!;

      // First, initialize the root view. The router store needs this to connect the initial route.
      appContext.rootView = initView({
        view: mainView.type as View<any>,
        props: mainView.props,
        appContext,
        elementContext,
      });

      // Initialize stores.
      for (let [key, item] of stores.entries()) {
        const { store, options } = item;

        // Channel prefix is displayed before the global's name in console messages that go through a debug channel.
        // Bundled stores get an additional 'dolla/' prefix so it's clear messages are from the framework.
        // 'dolla/*' messages are filtered out by default, but this can be overridden with the app's `debug.filter` option.
        const channelPrefix = isString(key) ? "dolla/store" : "store";
        const label = isString(key) ? key : store.name ?? "(anonymous)";
        const config = {
          store,
          appContext,
          elementContext,
          channelPrefix,
          label,
          options: options ?? {},
        };

        const instance = initStore(config);

        instance.setup();

        // Add instance and mark as ready.
        stores.set(key, { ...item, instance });
      }

      for (const { instance } of stores.values()) {
        instance!.connect();
      }

      if (configureCallback) {
        await configureCallback({
          // TODO: Add context methods
        });
      }

      // const { $isLoaded } = stores.get("language")!.instance!.exports as StoreExports<typeof LanguageStore>;

      const done = () => {
        // Then connect the root view.
        appContext.rootView!.connect(appContext.rootElement!);

        // The app is now connected.
        isConnected = true;

        resolve();
      };

      done();

      //       if ($isLoaded.get()) {
      //         return done();
      //       }
      //
      //       const stop = observe($isLoaded, (isLoaded) => {
      //         if (isLoaded) {
      //           stop();
      //           done();
      //         }
      //       });
    });
  }

  async function disconnect() {
    if (isConnected) {
      // Remove the root view from the page (runs teardown callbacks on all connected views).
      appContext.rootView!.disconnect();

      // The app is considered disconnected at this point
      isConnected = false;

      // Stop all observers
      // for (const stop of stopCallbacks) {
      //   stop();
      // }
      // stopCallbacks = [];

      // Disconnect stores
      for (const { instance } of stores.values()) {
        instance!.disconnect();
      }
    }
  }

  /*=============================*\
  ||           Contexts          ||
  \*=============================*/

  const appContext: AppContext = {
    crashCollector,
    debugHub,
    stores,
    mode: settings.mode ?? "production",
  };
  const elementContext: ElementContext = {
    stores: new Map(),
  };

  /*=============================*\
  ||          App Object         ||
  \*=============================*/

  const app = {
    connect,
    disconnect,

    get isConnected() {
      return isConnected;
    },

    //     language(tag: string, config: LanguageConfig) {
    //       languages.set(tag, config);
    //
    //       return app;
    //     },
    //
    //     setLanguage(tag: string, fallback?: string) {
    //       if (tag === "auto") {
    //         let tags = [];
    //
    //         if (typeof navigator === "object") {
    //           const nav = navigator as any;
    //
    //           if (nav.languages?.length > 0) {
    //             tags.push(...nav.languages);
    //           } else if (nav.language) {
    //             tags.push(nav.language);
    //           } else if (nav.browserLanguage) {
    //             tags.push(nav.browserLanguage);
    //           } else if (nav.userLanguage) {
    //             tags.push(nav.userLanguage);
    //           }
    //         }
    //
    //         for (const tag of tags) {
    //           if (languages.has(tag)) {
    //             // Found a matching language.
    //             currentLanguage = tag;
    //             return this;
    //           }
    //         }
    //
    //         if (!currentLanguage && fallback) {
    //           if (languages.has(fallback)) {
    //             currentLanguage = fallback;
    //           }
    //         }
    //       } else {
    //         // Tag is the actual tag to set.
    //         if (languages.has(tag)) {
    //           currentLanguage = tag;
    //         } else {
    //           throw new Error(`Language '${tag}' has not been added to this app yet.`);
    //         }
    //       }
    //
    //       return app;
    //     },

    configure(callback: ConfigureCallback) {
      if (configureCallback !== undefined) {
        debugChannel.warn(`Configure callback is already defined. Only the final configure call will take effect.`);
      }

      configureCallback = callback;

      return app;
    },
  };

  return app;
}

type CrashPageProps = {
  message: string;
  error: Error;
  componentName: string;
};

function DefaultCrashPage({ message, error, componentName }: CrashPageProps) {
  return m(
    "div",
    {
      style: {
        backgroundColor: "#880000",
        color: "#fff",
        padding: "2rem",
        position: "fixed",
        inset: 0,
        fontSize: "20px",
      },
    },
    m("h1", { style: { marginBottom: "0.5rem" } }, "The app has crashed"),
    m(
      "p",
      { style: { marginBottom: "0.25rem" } },
      m("span", { style: { fontFamily: "monospace" } }, componentName),
      " says:"
    ),
    m(
      "blockquote",
      {
        style: {
          backgroundColor: "#991111",
          padding: "0.25em",
          borderRadius: "6px",
          fontFamily: "monospace",
          marginBottom: "1rem",
        },
      },
      m(
        "span",
        {
          style: {
            display: "inline-block",
            backgroundColor: "red",
            padding: "0.1em 0.4em",
            marginRight: "0.5em",
            borderRadius: "4px",
            fontSize: "0.9em",
            fontWeight: "bold",
          },
        },
        error.name
      ),
      message
    ),
    m("p", {}, "Please see the browser console for details.")
  );
}
