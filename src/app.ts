import {
  assertFunction,
  assertInstanceOf,
  assertString,
  isFunction,
  isObject,
  isString,
  joinPath,
  patternToFragments,
  resolvePath,
  sortRoutes,
  splitPath,
  typeOf,
  type Route,
} from "@borf/bedrock";
import { CrashCollector } from "./classes/CrashCollector.js";
import { DebugHub, type DebugOptions } from "./classes/DebugHub.js";
import { DOMHandle, m } from "./markup.js";
import { observe } from "./state.js";
import { initStore, type Store } from "./store.js";
import { DialogStore } from "./stores/dialog.js";
import { DocumentStore } from "./stores/document.js";
import { HTTPStore } from "./stores/http.js";
import { LanguageStore, type LanguageConfig } from "./stores/language.js";
import { RenderStore } from "./stores/render.js";
import {
  RouterStore,
  type RedirectContext,
  type RouteConfig,
  type RouteLayer,
  type RouterOptions,
} from "./stores/router.js";
import { type BuiltInStores, type StoreExports } from "./types.js";
import { merge } from "./utils.js";
import { initView, type View, type ViewContext } from "./view.js";

// ----- Types ----- //

interface AppOptions {
  /**
   * Options for the debug system.
   */
  debug?: DebugOptions;

  /**
   * Options to configure how routing works.
   */
  router?: RouterOptions;

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

interface AppRouter {
  /**
   * Adds a new pattern, a view to display while that pattern matches the current URL, and an optional function to configure route chaining.
   * Route chaining allows you to add nested routes and redirects that are displayed within the `view`'s outlet while `pattern` matches the current URL.
   *
   * @param pattern - A URL pattern to match against the current URL.
   * @param view - The view to display while `pattern` matches the current URL.
   * @param subroutes - A callback that takes a router object. Use this to append nested routes and redirects.
   */
  route<I>(pattern: string, view: View<I>, subroutes?: (router: AppRouter) => void): this;

  /**
   * Adds a new pattern and chains a set of nested routes that are displayed without a layout `view`.
   *
   * @param pattern - A URL pattern to match against the current URL.
   * @param view - Pass null to render subroutes without a parent view.
   * @param subroutes - A callback that takes a router object. Use this to append nested routes and redirects.
   */
  route(pattern: string, view: null, subroutes: (router: AppRouter) => void): this;

  /**
   * Adds a new pattern that will redirect to a different route when matched.
   *
   * @param pattern - A URL pattern to match against the current URL.
   * @param redirectPath - A path to redirect to when `pattern` matches the current URL.
   */
  redirect(pattern: string, redirectPath: string): this;

  /**
   * Adds a new pattern that will redirect to a different route when matched, as calculated by a callback function.
   * Useful when you require more insight into the path that matched the pattern before deciding where to send the user.
   *
   * @param pattern - A URL pattern to match against the current URL.
   * @param createPath - A function that generates a redirect path from the current URL match.
   */
  redirect(pattern: string, createPath: (ctx: RedirectContext) => string): this;
}

interface ConfigureContext {
  // use
}

type ConfigureCallback = (ctx: ConfigureContext) => void | Promise<void>;

export interface App extends AppRouter {
  readonly isConnected: boolean;

  /**
   * Displays view at the root of the app. All other routes render inside this view's outlet.
   */
  main<A extends Record<string, any>>(view: View<A>, attributes?: A): this;

  /**
   * Makes this store accessible from any other component in the app, except for stores registered before this one.
   */
  store<O>(store: Store<O, any>, options?: O): this;

  /**
   * Returns the shared instance of `store`.
   */
  getStore<T extends Store<any, any>>(store: T): ReturnType<T>;
  /**
   * Returns the shared instance of a built-in store.
   */
  getStore<N extends keyof BuiltInStores>(name: N): BuiltInStores[N];

  /**
   * Adds a new language translation to the app.
   *
   * @param tag - A valid BCP47 language tag, like `en-US`, `en-GB`, `ja`, etc.
   * @param config - Language configuration.
   */
  language(tag: string, config: LanguageConfig): this;

  /**
   * Sets the initial language. The app will default to the first language added if this is not called.
   */
  setLanguage(tag: string): this;

  /**
   * Sets the initial language based on the user's locale.
   * Falls back to `fallback` language if provided, otherwise falls back to the first language added.
   *
   * @param tag - Set to "auto" to autodetect the user's language.
   * @param fallback - The language tag to default to if the app fails to detect an appropriate language.
   */
  setLanguage(tag: "auto", fallback?: string): this;

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

export function makeApp(options?: AppOptions): App {
  if (options && !isObject(options)) {
    throw new TypeError(`App options must be an object. Got: ${options}`);
  }

  let isConnected = false;
  let mainView = m(DefaultRootView);
  let configureCallback: ConfigureCallback | undefined;

  const settings: AppOptions = merge(
    {
      debug: {
        filter: "*,-dolla/*",
        log: "development", // Only print logs in development.
        warn: "development", // Only print warnings in development.
        error: true, // Always print errors.
      },
      router: {
        hash: false,
      },
      mode: "production",
    },
    options ?? {}
  );

  const stores = new Map<keyof BuiltInStores | Store<any, any>, StoreRegistration>([
    ["dialog", { store: DialogStore }],
    ["router", { store: RouterStore }],
    ["document", { store: DocumentStore }],
    ["http", { store: HTTPStore }],
    ["language", { store: LanguageStore }],
    ["render", { store: RenderStore }],
  ]);

  const languages = new Map<string, LanguageConfig>();
  let currentLanguage: string;

  /*=============================*\
  ||           Routing           ||
  \*=============================*/

  let layerId = 0;
  let routes: Route<RouteConfig["meta"]>[] = [];

  /**
   * Parses a route definition object into a set of matchable routes.
   *
   * @param route - Route config object.
   * @param layers - Array of parent layers. Passed when this function calls itself on nested routes.
   */
  function prepareRoute(
    route: {
      pattern: string;
      redirect?: string | ((ctx: RedirectContext) => void);
      view?: View<unknown> | null;
      subroutes?: (router: AppRouter) => void;
    },
    layers = []
  ) {
    if (!isObject(route) || !isString(route.pattern)) {
      throw new TypeError(`Route configs must be objects with a 'pattern' string property. Got: ${route}`);
    }

    const parts = splitPath(route.pattern);

    // Remove trailing wildcard for joining with nested routes.
    if (parts[parts.length - 1] === "*") {
      parts.pop();
    }

    const routes: RouteConfig[] = [];

    if (route.redirect) {
      let redirect = route.redirect;

      if (isString(redirect)) {
        redirect = resolvePath(joinPath(parts), redirect);

        if (!redirect.startsWith("/")) {
          redirect = "/" + redirect;
        }
      }

      routes.push({
        pattern: route.pattern,
        meta: {
          redirect,
        },
      });

      return routes;
    }

    let view: View<{}> | undefined;

    if (!route.view) {
      view = DefaultRootView;
    } else if (typeof route.view === "function") {
      view = route.view;
    } else {
      throw new TypeError(`Route '${route.pattern}' expected a view function. Got: ${route.view}`);
    }

    const markup = m(view);
    const layer: RouteLayer = { id: layerId++, markup };

    // Parse nested routes if they exist.
    if (route.subroutes) {
      const router: AppRouter = {
        route: (pattern: string, view: View<any> | null, subroutes: (router: AppRouter) => void) => {
          pattern = joinPath([...parts, pattern]);
          routes.push(...prepareRoute({ pattern, view, subroutes }));
          return router;
        },
        redirect: (pattern, redirect) => {
          pattern = joinPath([...parts, pattern]);
          routes.push(...prepareRoute({ pattern, redirect }));
          return router;
        },
      };

      route.subroutes(router);
    } else {
      routes.push({
        pattern: route.pattern,
        meta: {
          pattern: route.pattern,
          layers: [...layers, layer],
        },
      });
    }

    return routes;
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
  ||     Batched DOM Updates     ||
  \*=============================*/

  // let isUpdating = false;

  // // Keyed updates ensure only the most recent callback queued with a certain key
  // // will be called, keeping DOM operations to a minimum.
  // const queuedUpdatesKeyed = new Map<string, () => void>();
  // // All unkeyed updates are run on every batch.
  // let queuedUpdatesUnkeyed: (() => void)[] = [];

  // function runUpdates() {
  //   const totalQueued = queuedUpdatesKeyed.size + queuedUpdatesUnkeyed.length;

  //   if (!isConnected || totalQueued === 0) {
  //     isUpdating = false;
  //   }

  //   if (!isUpdating) return;

  //   requestAnimationFrame(() => {
  //     debugChannel.info(`Batching ${queuedUpdatesKeyed.size + queuedUpdatesUnkeyed.length} queued DOM update(s).`);

  //     // Run keyed updates first.
  //     for (const callback of queuedUpdatesKeyed.values()) {
  //       callback();
  //     }
  //     queuedUpdatesKeyed.clear();

  //     // Run unkeyed updates second.
  //     for (const callback of queuedUpdatesUnkeyed) {
  //       callback();
  //     }
  //     queuedUpdatesUnkeyed = [];

  //     // Trigger again to catch updates queued while this batch was running.
  //     runUpdates();
  //   });
  // }

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

      // Sort routes by specificity for correct matching.
      routes = sortRoutes(routes);

      // Pass language options to language store.
      const language = stores.get("language")!;
      stores.set("language", {
        ...language,
        options: {
          languages: Object.fromEntries(languages.entries()),
          currentLanguage,
        },
      });

      // Pass route options to router store.
      const router = stores.get("router")!;
      stores.set("router", {
        ...router,
        options: {
          options: settings.router,
          routes: routes,
        },
      });

      debugChannel.info(`Total routes: ${routes.length}`);

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
        // Built-in globals get an additional 'dolla/' prefix so it's clear messages are from the framework.
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

      const { $isLoaded } = stores.get("language")!.instance!.exports as StoreExports<typeof LanguageStore>;

      const done = () => {
        // Then connect the root view.
        appContext.rootView!.connect(appContext.rootElement!);

        // The app is now connected.
        isConnected = true;

        resolve();
      };

      if ($isLoaded.get()) {
        return done();
      }

      const stop = observe($isLoaded, (isLoaded) => {
        if (isLoaded) {
          stop();
          done();
        }
      });
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
    // $dialogs - added by dialog store
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

    main<A extends Record<string, any>>(view: View<A>, attributes?: A) {
      if (mainView.type !== DefaultRootView) {
        debugChannel.warn(`Root view is already defined. Only the final main call will take effect.`);
      }

      if (typeof view === "function") {
        mainView = m(view, attributes);
      } else {
        throw new TypeError(`Expected a view function. Got type: ${typeOf(view)}, value: ${view}`);
      }

      return app;
    },

    store<O>(store: Store<O, any>, options?: O) {
      let config: StoreRegistration | undefined;

      if (isFunction(store)) {
        config = { store, options };
      } else {
        throw new TypeError(`Expected a store function. Got type: ${typeOf(store)}, value: ${store}`);
      }

      assertFunction(store, "Expected a store function or a store config object. Got type: %t, value: %v");

      stores.set(store, config);

      return app;
    },

    getStore(store: keyof BuiltInStores | Store<any, any>) {
      const match = stores.get(store);
      const name = isString(store) ? store : store.name;
      if (!match) {
        throw new Error(`Store '${name}' is not registered on this app.`);
      }
      if (!match.instance) {
        throw new Error(`Store '${name}' is not yet initialized. App must be connected first.`);
      }
      return match.instance.exports;
    },

    language(tag: string, config: LanguageConfig) {
      languages.set(tag, config);

      return app;
    },

    setLanguage(tag: string, fallback?: string) {
      if (tag === "auto") {
        let tags = [];

        if (typeof navigator === "object") {
          const nav = navigator as any;

          if (nav.languages?.length > 0) {
            tags.push(...nav.languages);
          } else if (nav.language) {
            tags.push(nav.language);
          } else if (nav.browserLanguage) {
            tags.push(nav.browserLanguage);
          } else if (nav.userLanguage) {
            tags.push(nav.userLanguage);
          }
        }

        for (const tag of tags) {
          if (languages.has(tag)) {
            // Found a matching language.
            currentLanguage = tag;
            return this;
          }
        }

        if (!currentLanguage && fallback) {
          if (languages.has(fallback)) {
            currentLanguage = fallback;
          }
        }
      } else {
        // Tag is the actual tag to set.
        if (languages.has(tag)) {
          currentLanguage = tag;
        } else {
          throw new Error(`Language '${tag}' has not been added to this app yet.`);
        }
      }

      return app;
    },

    route(pattern: string, view: View<unknown> | null, subroutes?: (sub: AppRouter) => void) {
      assertString(pattern, "Pattern must be a string. Got type: %t, value: %v");

      if (view == null) {
        assertFunction(subroutes, "Sub routes must be defined when `view` is null.");
      }

      prepareRoute({ pattern, view, subroutes }).forEach((route) => {
        routes.push({
          pattern: route.pattern,
          meta: route.meta,
          fragments: patternToFragments(route.pattern),
        });
      });

      return app;
    },

    redirect(pattern: string, redirect: string | ((ctx: RedirectContext) => string)) {
      if (!isFunction(redirect) && !isString(redirect)) {
        throw new TypeError(`Expected a redirect path or function. Got type: ${typeOf(redirect)}, value: ${redirect}`);
      }

      prepareRoute({ pattern, redirect }).forEach((route) => {
        routes.push({
          pattern: route.pattern,
          meta: route.meta,
          fragments: patternToFragments(route.pattern),
        });
      });

      return app;
    },

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
