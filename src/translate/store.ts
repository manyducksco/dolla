import { $debug, $name, $setup } from "../core/hooks.js";
import { computed, state, track, type MaybeReadable, type Reactive } from "../core/reactive.js";
import { isFunction } from "../typeChecking.js";
import { Format } from "./template.js";
import { LocalizedStrings, Translation, TranslationFetchFn } from "./translation.js";

// ----- Types ----- //

export type TOptions = {
  /**
   *
   */
  count?: MaybeReadable<number>;

  /**
   *
   */
  context?: MaybeReadable<string>;

  /**
   * Override formats specified in the template with the ones in the array for each named variable.
   *
   * @example
   * t("example_key", {
   *   count: 5,
   *   formatOverrides: {
   *     count: [ { name: "datetime", options: { style: "currency", currency: "JPY" } } ]
   *   }
   * });
   */
  formatOverrides?: MaybeReadable<Record<string, Record<string, Format[]>>>;

  [value: string]: MaybeReadable<any>;
};

export type Formatter = (locale: string, value: any, options: Record<string, any>) => string;

type BuiltInFormatters = {
  number: [number | bigint, Intl.NumberFormatOptions?];
  datetime: [Date, Intl.DateTimeFormatOptions?];
  list: [Iterable<string>, Intl.ListFormatOptions?];
};

export interface TranslateAPI {
  /**
   * An array of locale names for all translations the app supports.
   */
  supportedLocales: string[];

  /**
   * A Readable containing the currently loaded locale.
   */
  currentLocale: Reactive<string>;

  /**
   * Updates the locale, fetching any translation files as required.
   * Returns a promise that resolves when the new locale is applied.
   *
   * If `name` is undefined the library will try to match the browser language automatically.
   */
  setLocale(name?: string): Promise<void>;

  /**
   * Returns a Readable of the value at `key`.

   * @param selector - Key to the translated value.
   * @param options - A map of `{{placeholder}}` names and the values to replace them with.
   *
   * @example
   * const value = t("your.key.here", { count: 5 });
   */
  t(selector: string, options?: TOptions): Reactive<string>;

  format<K extends keyof BuiltInFormatters, V extends BuiltInFormatters[K][0], O extends BuiltInFormatters[K][1]>(
    name: K,
    value: MaybeReadable<V>,
    options?: O,
  ): Reactive<string>;

  format<V, O>(name: string, value: MaybeReadable<V>, options?: O): Reactive<string>;
}

export interface TranslateOptions {
  translations: Record<string, LocalizedStrings | TranslationFetchFn>;

  /**
   * Default locale to load on startup. The translator will try to match the user's browser language if left undefined.
   */
  locale?: string;

  formatters?: Record<string, Formatter>;
}

// ----- Code ----- //

export function TranslateStore(options: TranslateOptions): TranslateAPI {
  $name("dolla.translate");

  const debug = $debug();

  $setup(() => {
    const locales = Object.keys(options.translations);
    debug.info(`${locales.length} language${locales.length === 1 ? "" : "s"} supported: '${locales.join("', '")}'`);
  });

  const formatters = new Map<string, Formatter>();

  formatters.set("number", (locale, value, options) => {
    return new Intl.NumberFormat(locale, options).format(value);
  });
  formatters.set("datetime", (locale, value, options) => {
    return new Intl.DateTimeFormat(locale, options).format(value);
  });
  formatters.set("list", (locale, value, options) => {
    return new Intl.ListFormat(locale, options).format(value);
  });

  if (options.formatters) {
    for (const key in options.formatters) {
      formatters.set(key, options.formatters[key]);
    }
  }

  const translations = new Map<string, Translation>();

  const currentLocale = state("en");
  const currentTranslation = computed(() => translations.get(currentLocale.track())!);

  // Convert translations into Translation instances.
  for (const locale in options.translations) {
    const entry = options.translations[locale];
    if (isFunction(entry)) {
      translations.set(locale, new Translation(locale, formatters, entry));
    } else {
      translations.set(locale, new Translation(locale, formatters, () => entry));
    }
  }

  const supportedLocales = [...translations.keys()];

  async function setLocale(name?: string) {
    let realName!: string;

    if (name === undefined || name === "auto") {
      let names = [];

      if (typeof navigator !== "undefined") {
        const nav = navigator as any;

        if (nav.languages?.length > 0) {
          names.push(...nav.languages);
        } else if (nav.language) {
          names.push(nav.language);
        } else if (nav.browserLanguage) {
          names.push(nav.browserLanguage);
        } else if (nav.userLanguage) {
          names.push(nav.userLanguage);
        }
      }

      for (const name of names) {
        if (translations.has(name)) {
          // Found a matching language.
          realName = name;
          break;
        }
      }
    } else {
      // Tag is the actual tag to set.
      if (translations.has(name)) {
        realName = name;
      }
    }

    if (realName == null) {
      const firstLanguage = translations.keys().next().value;
      if (firstLanguage) {
        realName = firstLanguage;
      }
    }

    if (!realName || !translations.has(realName)) {
      throw new Error(`Locale '${name}' has no translation.`);
    }

    const translation = translations.get(realName)!;
    await translation.load();

    currentTranslation.get()?.unload();
    currentLocale.set(realName);
  }

  function t(selector: string, options?: TOptions): Reactive<string> {
    return computed(() => {
      const values: Record<string, any> = {};

      // Track all option values.
      for (const key in options) {
        values[key] = track(options[key]);
      }

      return currentTranslation.track().getValue(selector, values);
    });
  }

  function format<
    K extends keyof BuiltInFormatters,
    V extends BuiltInFormatters[K][0],
    O extends BuiltInFormatters[K][1],
  >(name: K, value: MaybeReadable<V>, options?: O): Reactive<string>;

  function format<V, O>(name: string, value: MaybeReadable<V>, options?: O): Reactive<string>;

  function format(name: string, value: MaybeReadable<any>, options?: Record<string, any>): Reactive<string> {
    const callback = formatters.get(name);
    if (!callback) {
      throw new Error(`Unknown format: ${name}`);
    }

    return computed(() => callback(currentLocale.track(), track(value), options ?? {}));
  }

  return {
    supportedLocales,
    currentLocale,
    setLocale,
    t,
    format,
  };
}
