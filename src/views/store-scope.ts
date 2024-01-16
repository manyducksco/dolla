import { isFunction } from "@borf/bedrock";
import { Store, initStore } from "../store.js";
import { ViewContext, getViewSecrets } from "../view.js";

export interface StoreConfig<O, E> {
  store: Store<O, E>;
  options?: O;
}

export interface StoreScopeProps<O, E> {
  stores: (StoreConfig<O, E> | Store<O, E>)[];
}

/**
 * Creates an instance of a store available only to children of this StoreScope.
 */
export function StoreScope<O, E>(props: StoreScopeProps<O, E>, ctx: ViewContext) {
  const { appContext, elementContext } = getViewSecrets(ctx);

  const instances: ReturnType<typeof initStore>[] = [];

  for (const config of props.stores) {
    let store: Store<O, E>;
    let options: O | undefined;

    if (isFunction(config)) {
      store = config as Store<O, E>;
    } else {
      store = (config as StoreConfig<O, E>).store;
      options = (config as StoreConfig<O, E>).options;
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
