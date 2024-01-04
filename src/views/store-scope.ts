import { Store, initStore } from "../store.js";
import { ViewContext, getViewSecrets } from "../view.js";

export interface StoreScopeProps<O, E> {
  store: Store<O, E>;
  options?: O;
}

/**
 * Creates an instance of a store available only to children of this StoreScope.
 */
export function StoreScope<O, E>(props: StoreScopeProps<O, E>, ctx: ViewContext) {
  const { appContext, elementContext } = getViewSecrets(ctx);

  const instance = initStore({
    store: props.store,
    options: props.options!,
    appContext,
    elementContext,
  });

  instance.setup();

  elementContext.stores.set(props.store, {
    store: props.store,
    options: props.options,
    instance,
  });

  // ctx.log(Array.from(elementContext.stores.keys()));

  ctx.beforeConnect(() => {
    return instance.connect();
  });

  ctx.onDisconnected(() => {
    instance.disconnect();
  });

  return ctx.outlet();
}
