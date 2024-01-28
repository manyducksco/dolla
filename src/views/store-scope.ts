import { Store, initStore } from "../store.js";
import { isFunction } from "../typeChecking.js";
import { ViewContext, getViewSecrets } from "../view.js";

export interface StoreConfig<O, E> {
  store: Store<O, E>;
  options?: O;
}

export interface StoreScopeProps {
  stores: (StoreConfig<unknown, unknown> | Store<unknown, unknown>)[];
}

/**
 * Creates an instance of a store available only to children of this StoreScope.
 */
export function StoreScope(props: StoreScopeProps, ctx: ViewContext) {
  const { appContext, elementContext } = getViewSecrets(ctx);

  const instances: ReturnType<typeof initStore>[] = [];

  for (const config of props.stores) {
    let store: Store<unknown, unknown>;
    let options: unknown;

    if (isFunction(config)) {
      store = config as Store<unknown, unknown>;
    } else {
      store = (config as StoreConfig<unknown, unknown>).store;
      options = (config as StoreConfig<unknown, unknown>).options;
    }

    const instance = initStore({
      store,
      options,
      appContext,
      elementContext,
    });

    instance.setup();

    elementContext.stores.set(store, { store, options, instance });

    instances.push(instance);
  }

  ctx.beforeConnect(() => {
    for (const instance of instances) {
      instance.connect();
    }
  });

  ctx.onDisconnected(() => {
    for (const instance of instances) {
      instance.disconnect();
    }
  });

  return ctx.outlet();
}
