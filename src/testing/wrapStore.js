import { MockDialogStore } from "./stores/dialog.js";
import { MockRouterStore } from "./stores/router.js";
import { MockPageStore } from "./stores/page.js";
import { MockHTTPStore } from "./stores/http.js";
import { makeMockDOMNode } from "./makeMockDOMNode.js";
import { isString } from "../classes/utils/typeChecking.js";
import { DebugHub } from "../classes/classes/DebugHub.js";
import { Store } from "../classes/classes/Store.old.js";

/**
 * Wraps a store in a test adapter that lets you call its lifecycle methods and access its exports.
 * You can pass any 'stores' or 'inputs' this store relies on through the config object.
 */
export async function wrapStore(store, config = {}) {
  const stores = new Map([
    ["dialog", { store: MockDialogStore }],
    ["router", { store: MockRouterStore }],
    ["page", { store: MockPageStore }],
    ["http", { store: MockHTTPStore }],
    // TODO: Language?
  ]);

  const appContext = {
    debugHub: new DebugHub(),
    stores: new Map(),
    rootElement: makeMockDOMNode(),
  };

  const elementContext = {
    stores: new Map(),
  };

  let instance;

  if (config.stores) {
    for (const store of config.stores) {
      if (Store.isStore(store)) {
        store = { store: store };
      }

      if (isString(store.store)) {
        // Convert { store: "string", exports: Store } into { store: Store }, overwriting "string" built in.
        if (store.exports == null) {
          throw new Error("An 'exports' store must be defined when overriding a built in store.");
        }

        if (!Store.isStore(store.exports)) {
          throw new TypeError(`Store config 'exports' must be a store class. Got: ${store.exports}`);
        }

        stores.set(store.store, {
          store: store.exports,
          inputs: store.inputs,
          instance: undefined,
          ready: false,
        });
      } else if (Store.isStore(store.store)) {
        // Convert { store: Store, exports: Store } into { store: Store } where the final 'store' is the original 'exports'.
        if (store.exports && !Store.isStore(store.exports)) {
          throw new TypeError(`Store config 'exports' must be a store class. Got: ${store.exports}`);
        }

        stores.set(store.store, {
          store: store.exports || store.store,
          inputs: store.inputs,
          instance: undefined,
          ready: false,
        });
      } else {
        throw new TypeError(`config.stores must contain only store classes or store config objects. Got: ${store}`);
      }
    }
  }

  for (const [key, config] of stores) {
    const instance = new config.store({
      appContext,
      elementContext,
      inputs: config.inputs,
      inputDefs: config.store.inputs,
    });

    if (!(instance instanceof Store)) {
      throw new TypeError(`config.exports did not result in a valid Store object. Got: ${config.exports}`);
    }

    await instance.connect(appContext.rootElement);

    appContext.stores.set(key, { store: config.store, instance, ready: true });
  }

  instance = new store({
    appContext,
    elementContext,
    inputs: config.inputs,
    inputDefs: store.inputs,
    channelPrefix: "test:store",
    label: store.label,
  });

  await instance.connect(appContext.rootElement);

  return {
    exports: instance.exports,

    async teardown() {
      await instance.disconnect();

      for (const [key, config] of appContext.stores) {
        await config.instance.disconnect();
      }
    },
  };
}
