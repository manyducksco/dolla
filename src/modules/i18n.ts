import { createState, derive, isState, MaybeState, toState, type State } from "../state.js";
import { isFunction, isObject, isString } from "../typeChecking.js";
import type { Stringable } from "../types.js";
import { deepEqual } from "../utils.js";
import type { Dolla, Logger } from "./dolla.js";

// ----- Types ----- //

// TODO: Is there a good way to represent infinitely nested recursive types?
/**
 * An object where values are either a translated string or another nested Translation object.
 */
type LocalizedStrings = Record<
  string,
  string | Record<string, string | Record<string, string | Record<string, string>>>
>;

export interface TranslationConfig {
  /**
   * Name of the locale this translation is for (BCP 47 locale names recommended).
   */
  locale: string;

  /**
   * Path to a JSON file with translated strings for this language.
   */
  path?: string;

  /**
   * A callback function that returns a Promise that resolves to the translation object for this language.
   */
  fetch?: () => Promise<LocalizedStrings>;
}

export type I18nSetupOptions = {
  /**
   * Default locale to load on startup
   */
  locale?: string | null;

  translations: TranslationConfig[];
};

export type TOptions = {
  /**
   *
   */
  count?: MaybeState<number>;

  /**
   *
   */
  context?: MaybeState<string>;

  [value: string]: MaybeState<any>;
};

// ----- Code ----- //

// Fallback labels for missing state and data.
const $noLanguageValue = toState("[NO LANGUAGE SET]");

class Localization {
  dolla: Dolla;
  config: TranslationConfig;
  strings?: LocalizedStrings;

  constructor(config: TranslationConfig, dolla: Dolla) {
    this.config = config;
    this.dolla = dolla;
  }

  async load(): Promise<LocalizedStrings> {
    if (this.strings == null) {
      if (isFunction(this.config.fetch)) {
        const strings = await this.config.fetch();
        if (isObject(strings)) {
          this.strings = strings as LocalizedStrings;
        } else {
          throw new Error(`Fetch function did not return an object of language strings: ${strings}`);
        }
      } else if (isString(this.config.path)) {
        const res = await this.dolla.http.get(this.config.path);
        if (res.status >= 200 && res.status < 300) {
          if (isObject(res.body)) {
            this.strings = res.body as LocalizedStrings;
          } else {
            throw new Error(
              `Language path '${this.config.path}' did not return an object of language strings: ${res.body}`,
            );
          }
        } else {
          throw new Error(`HTTP request failed.`);
        }
      }
    }

    if (this.strings == null) {
      throw new Error(`Language could not be loaded.`);
    } else {
      return this.strings;
    }
  }
}

/**
 * Dolla's I(nternationalizatio)n module. Manages language translations and locale-based formatting.
 */
export class I18n {
  #dolla: Dolla;
  #logger: Logger;
  #localizations = new Map<string, Localization>();
  #cache: [key: string, values: Record<string, any> | undefined, output: string][] = [];

  #initialLocale = "auto";

  $locale: State<string | undefined>;
  #setLocale;
  #$strings;
  #setStrings;

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("dolla/i18n");

    const [$locale, setLocale] = createState<string>();
    const [$strings, setStrings] = createState<LocalizedStrings>();

    this.$locale = $locale;
    this.#setLocale = setLocale;
    this.#$strings = $strings;
    this.#setStrings = setStrings;

    /**
     * Load language before the app mounts.
     */
    dolla.beforeMount(async () => {
      if (this.#localizations.size > 0) {
        await this.setLocale(this.#initialLocale);
      }
    });
  }

  get locales() {
    return [...this.#localizations.keys()];
  }

  setup(options: I18nSetupOptions) {
    // Convert languages into Language instances.
    options.translations.forEach((entry) => {
      this.#localizations.set(entry.locale, new Localization(entry, this.#dolla));
    });

    // Check that initialLanguage is actually registered.
    if (options.locale && options.locale !== "auto") {
      const isRegistered = options.translations.some((entry) => entry.locale === options.locale);
      if (!isRegistered) {
        throw new Error(`Initial locale '${options.locale}' is not registered in the locales array.`);
      }
      this.#initialLocale = options.locale;
    }

    this.#logger.info(
      `${this.#localizations.size} language${this.#localizations.size === 1 ? "" : "s"} supported: '${[...this.#localizations.keys()].join("', '")}'`,
    );
  }

  async setLocale(name: string) {
    let realName!: string;

    if (name === "auto") {
      let names = [];

      if (typeof navigator === "object") {
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
        if (this.#localizations.has(name)) {
          // Found a matching language.
          realName = name;
        }
      }
    } else {
      // Tag is the actual tag to set.
      if (this.#localizations.has(name)) {
        realName = name;
      }
    }

    if (realName == null) {
      const firstLanguage = this.#localizations.keys().next().value;
      if (firstLanguage) {
        realName = firstLanguage;
      }
    }

    if (!realName || !this.#localizations.has(realName)) {
      throw new Error(`Language '${name}' is not configured for this app.`);
    }

    const lang = this.#localizations.get(realName)!;

    try {
      const translation = await lang.load();

      this.#cache = [];
      this.#setStrings(translation);
      this.#setLocale(realName);

      this.#logger.info("set language to " + realName);
    } catch (error) {
      if (error instanceof Error) {
        this.#logger.crash(error);
      }
    }
  }

  /**
   * Returns a State containing the value at `key`.
  
   * @param key - Key to the translated value.
   * @param options - A map of {{placeholder}} names and the values to replace them with.
   * 
   * @example
   * const $value = t("your.key.here");
   */
  t(key: string, options?: TOptions): State<string> {
    if (this === undefined) {
      throw new Error(
        `The 't' function cannot be destructured. If you need a standalone version you can import it like so: 'import { t } from "@manyducks.co/dolla"'`,
      );
    }

    if (!this.$locale.get()) {
      return $noLanguageValue;
    }

    let keys = [];
    let values = [];
    for (const key in options) {
      keys.push(key);
      values.push(options[key]);
    }

    return derive([this.$locale, ...values], (locale, ...current) => {
      const merged: Record<string, any> = {};
      for (let i = 0; i < current.length; i++) {
        merged[keys[i]] = current[i];
      }

      const cached = this.#getCached(key, merged);
      if (cached) return cached;

      // Strings is not a dependency because it always changes together with locale.
      const strings = this.#$strings.get();

      // Handle count (pluralization) and context. Keys become "key_context_pluralization".
      let fullKey = key;
      if (merged.context != null) {
        fullKey += "_" + merged.context;
      }
      if (merged.count != null) {
        if (merged.ordinal) {
          // Try to match the exact number key if there is one (e.g. "myExampleKey_ordinal_(=2)" when count is 2).
          const exactKey = `${fullKey}_ordinal_(=${merged.count})`;
          if (resolve(strings, exactKey) != null) {
            fullKey = exactKey;
          } else {
            fullKey += "_ordinal_" + new Intl.PluralRules(locale, { type: "ordinal" }).select(merged.count);
          }
        } else {
          // Try to match the exact number key if there is one (e.g. "myExampleKey_(=2)" when count is 2).
          const exactKey = `${fullKey}_(=${merged.count})`;
          if (resolve(strings, exactKey) != null) {
            fullKey = exactKey;
          } else {
            fullKey += "_" + new Intl.PluralRules(locale).select(merged.count);
          }
        }
      }

      const translation = resolve(strings, fullKey) || `[MISSING: ${fullKey}]`;
      const output = this.#replaceMustaches(translation, merged);

      this.#cache.push([key, merged, output]);

      return output;
    });
  }

  /**
   * Creates an `Intl.Collator` configured for the current locale.
   * NOTE: The Collator remains bound to the locale it was created with, even when the app's locale changes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator#options
   */
  collator(options?: Intl.CollatorOptions) {
    return new Intl.Collator(this.$locale.get(), options);
  }

  /**
   * Returns a State containing the number formatted for the current locale. Uses `Intl.NumberFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options
   */
  number(count: MaybeState<number | bigint>, options?: Intl.NumberFormatOptions): State<string> {
    return derive([this.$locale, count], (_, value) => this.#formatNumber(value, options));
  }

  #formatNumber(count: number | bigint, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.$locale.get(), options).format(count);
  }

  /**
   * Returns a State containing the date formatted for the current locale. Uses `Intl.DateTimeFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
   *
   * @example
   * const date = new Date();
   * const $formatted = Dolla.i18n.dateTime(date, { dateFormat: "short" });
   */
  dateTime(date?: MaybeState<string | number | Date | undefined>, options?: Intl.DateTimeFormatOptions): State<string> {
    return derive([this.$locale, date], (_, value) => this.#formatDateTime(value, options));
  }

  #formatDateTime(date?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.$locale.get(), options).format(
      typeof date === "string" ? new Date(date) : date,
    );
  }

  /**
   * Returns a State containing the date formatted for the current locale. Uses `Intl.DateTimeFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
   *
   * @example
   * const list = new Date();
   * const $formatted = Dolla.i18n.list(list, {  });
   */
  list(list: MaybeState<Iterable<string>>, options?: Intl.ListFormatOptions): State<string> {
    return derive([this.$locale, list], (_, value) => this.#formatList(value, options));
  }

  #formatList(list: Iterable<string>, options?: Intl.ListFormatOptions): string {
    return new Intl.ListFormat(this.$locale.get(), options).format(list);
  }

  // relativeTime(): State<string> {

  // }

  #getCached(key: string, values?: Record<string, any>): string | undefined {
    for (const entry of this.#cache) {
      if (entry[0] === key && deepEqual(entry[1], values)) {
        return entry[2];
      }
    }
  }

  /**
   * Replaces {{placeholders}} with values in translated strings.
   */
  #replaceMustaches(template: string, values: Record<string, Stringable>) {
    // TODO: Handle formatting

    for (const name in values) {
      if (name === "count") {
        template = template.replace(`{{${name}}}`, this.#formatNumber(Number(values[name]), values));
      } else {
        template = template.replace(`{{${name}}}`, String(resolve(values, name)));
      }
    }
    return template;
  }
}

function resolve(object: any, key: string) {
  const parsed = String(key)
    .split(/[\.\[\]]/)
    .filter((part) => part.trim() !== "");
  let value = object;

  while (parsed.length > 0) {
    const part = parsed.shift()!;

    if (value != null) {
      value = value[part];
    } else {
      value = undefined;
    }
  }

  return value;
}
