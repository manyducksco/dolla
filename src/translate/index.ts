import { $use, type DollaPlugin } from "../core";
import { type TranslateOptions, TranslateStore } from "./store";

export function createTranslate(options: TranslateOptions): DollaPlugin {
  return async function setup(context) {
    const store = context.provideStore(TranslateStore, options).useStore(TranslateStore);
    await store.setLocale(options.locale);
  };
}

export function $translate() {
  return $use(TranslateStore);
}
