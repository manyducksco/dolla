import type { Context } from "../core/context.js";
import type { DollaPlugin } from "../core/root.js";
import { compose, createAtom, get, type Getter, type MaybeGetter } from "../core/signals.js";
import { isFunction } from "../utils.js";

// ----- Types ----- //

/**
 * A JSON object of translated strings. Values can be string templates or nested objects.
 */
export interface LocalizedStrings extends Record<string, string | LocalizedStrings> {}

/**
 * A function that returns an object of localized strings.
 */
export type TranslationFetchFn = () => LocalizedStrings | Promise<LocalizedStrings>;

export type TOptions = {
  /** Selects a plural variant, such as `key_one` or `key_(=2)`. */
  count?: Getter<number> | number;

  /** Uses ordinal plural variants, such as `key_ordinal_two`, for `count`. */
  ordinal?: Getter<boolean> | boolean;

  /** Selects a context variant, such as `key_formal`. */
  context?: Getter<string> | string;

  [value: string]: Getter<any> | any;
};

export type LookupFn = (selector: string, options?: TOptions) => string;

export type Formatter = (locale: string, value: any, options: Record<string, any>) => string;

/** Value and options types for each built-in formatter. */
type BuiltInFormatters = {
  number: [number | bigint, Intl.NumberFormatOptions];
  datetime: [Date | number | string, Intl.DateTimeFormatOptions];
  list: [Iterable<string>, Intl.ListFormatOptions];
};

export interface Translator {
  /**
   * An array of locale names for all translations the app supports.
   */
  supportedLocales: string[];

  /**
   * A Readable containing the currently loaded locale.
   */
  currentLocale: Getter<string>;

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
  t(selector: string, options?: TOptions): Getter<string>;

  format<K extends keyof BuiltInFormatters>(
    name: K,
    value: MaybeGetter<BuiltInFormatters[K][0]>,
    options?: BuiltInFormatters[K][1],
  ): Getter<string>;

  /** Custom formatters. Built-in names are excluded so their calls are always type checked. */
  format<N extends string>(
    name: N extends keyof BuiltInFormatters ? never : N,
    value: unknown,
    options?: Record<string, any>,
  ): Getter<string>;
}

export interface TranslatorOptions {
  translations: Record<string, LocalizedStrings | TranslationFetchFn>;

  /**
   * Default locale to load on startup. The translator will try to match the user's browser language if left undefined.
   */
  locale?: string;

  formatters?: Record<string, Formatter>;
}

const TRANSLATE = Symbol.for("$_DOLLA_TRANSLATE");

/** How long a loaded locale stays cached after it stops being the current locale. */
const LOCALE_CACHE_TIME = 5 * 60 * 1000;

type CachedLocale = {
  lookup: Promise<LookupFn>;
  evictTimer?: ReturnType<typeof setTimeout>;
};

export function createTranslate(options: TranslatorOptions): DollaPlugin {
  return async function (context) {
    const translator = createTranslator(options);
    context[TRANSLATE] = translator;
    await translator.setLocale(options.locale);
  };
}

export function getTranslate(context: Context): Translator {
  if (!context[TRANSLATE]) throw new Error("Translate plugin isn't loaded.");
  return context[TRANSLATE];
}

// ----- Code ----- //

function createTranslator(options: TranslatorOptions): Translator {
  const formatters = new Map<string, Formatter>();

  const numberFormat = reuseFormatters((locale, options) => new Intl.NumberFormat(locale, options));
  const dateTimeFormat = reuseFormatters((locale, options) => new Intl.DateTimeFormat(locale, options));
  const listFormat = reuseFormatters((locale, options) => new Intl.ListFormat(locale, options));

  formatters.set("number", (locale, value, options) => {
    return numberFormat(locale, options).format(typeof value === "bigint" ? value : Number(value));
  });
  formatters.set("datetime", (locale, value, options) => {
    return dateTimeFormat(locale, options).format(new Date(value));
  });
  formatters.set("list", (locale, value, options) => {
    return listFormat(locale, options).format(value);
  });

  if (options.formatters) {
    for (const key in options.formatters) {
      formatters.set(key, options.formatters[key]);
    }
  }

  let lookup: LookupFn | undefined;
  let activeLocale: string | undefined;
  let localeToken = 0;

  // Loaded locales, so switching back to one doesn't fetch it again. An entry
  // holds the pending load too, so concurrent calls share one fetch.
  const cache = new Map<string, CachedLocale>();

  function loadLocale(locale: string): Promise<LookupFn> {
    const cached = cache.get(locale);
    if (cached) {
      clearTimeout(cached.evictTimer);
      cached.evictTimer = undefined;
      return cached.lookup;
    }

    const entry: CachedLocale = { lookup: createLookup(locale, formatters, options.translations[locale]) };
    cache.set(locale, entry);
    // Failed loads aren't kept, so the next setLocale tries again.
    entry.lookup.catch(() => {
      if (cache.get(locale) === entry) cache.delete(locale);
    });
    return entry.lookup;
  }

  /** Drops a loaded locale once it has gone unused for `LOCALE_CACHE_TIME`. */
  function scheduleEviction(locale: string) {
    const entry = cache.get(locale);
    if (!entry || locale === activeLocale) return;

    clearTimeout(entry.evictTimer);
    entry.evictTimer = setTimeout(() => {
      if (locale !== activeLocale && cache.get(locale) === entry) cache.delete(locale);
    }, LOCALE_CACHE_TIME);
  }

  const [currentLocale, setCurrentLocale] = createAtom("en");
  const supportedLocales = [...Object.keys(options.translations)];

  /**
   * Loads translation for the locale.
   */
  async function setLocale(name?: string) {
    let locale: string | undefined;

    if (name === undefined) {
      // Use the first browser language with translations, or else the first locale.
      const languages = globalThis.navigator?.languages ?? [];
      locale = languages.find((language) => language in options.translations) ?? supportedLocales[0];
    } else if (name in options.translations) {
      locale = name;
    }

    if (locale === undefined) {
      throw new Error(`Locale '${name}' has no translation.`);
    }

    const token = ++localeToken;
    const nextLookup = await loadLocale(locale);

    // A later setLocale call was made while this one was loading; let that one win.
    if (token !== localeToken) {
      scheduleEviction(locale);
      return;
    }

    const previous = activeLocale;
    activeLocale = locale;
    lookup = nextLookup;
    if (previous !== undefined && previous !== locale) scheduleEviction(previous);

    // Update locale string after init so t() signals will update.
    setCurrentLocale(locale);
  }

  function t(selector: string, options?: TOptions): Getter<string> {
    return compose(() => {
      currentLocale(); // track locale
      return lookup?.(selector, options) ?? selector;
    });
  }

  function format(name: string, value: unknown, options?: Record<string, any>): Getter<string> {
    const callback = formatters.get(name);
    if (!callback) {
      throw new Error(`Unknown format: ${name}`);
    }

    return compose(() => callback(currentLocale(), get(value), options ?? {}));
  }

  return {
    supportedLocales,
    currentLocale,
    setLocale,
    t,
    format,
  };
}

/** The most formatters of one kind to keep. Reaching it means options vary without limit, so the cache starts over. */
const MAX_REUSED_FORMATTERS = 200;

/**
 * Wraps a function that constructs an `Intl` formatter so that it returns the
 * same formatter for the same locale and options. Constructing one costs many
 * times more than formatting a value with it.
 */
function reuseFormatters<T>(
  create: (locale: string, options: Record<string, any>) => T,
): (locale: string, options: Record<string, any>) => T {
  const cache = new Map<string, T>();

  return (locale, options) => {
    // Options objects are usually written inline, so they are matched by content.
    const key = locale + JSON.stringify(options);
    let formatter = cache.get(key);
    if (!formatter) {
      if (cache.size >= MAX_REUSED_FORMATTERS) cache.clear();
      cache.set(key, (formatter = create(locale, options)));
    }
    return formatter;
  };
}

/**
 * Loads the translation and produces an efficient lookup function.
 */
async function createLookup(
  locale: string,
  formatters: Map<string, Formatter>,
  translation: TranslationFetchFn | LocalizedStrings,
) {
  const strings = isFunction(translation) ? await translation() : translation;
  const entries = compile(strings);
  const templates = new Map(entries);
  // Created on first use, since building plural rules is relatively slow.
  let pluralRules: Intl.PluralRules | undefined;
  let ordinalRules: Intl.PluralRules | undefined;

  function getPluralRules(ordinal: boolean): Intl.PluralRules {
    if (ordinal) return (ordinalRules ??= new Intl.PluralRules(locale, { type: "ordinal" }));
    return (pluralRules ??= new Intl.PluralRules(locale));
  }

  /**
   * Looks up the template and produces the output. Any reactive values in `options` are tracked when used.
   */
  /**
   * Finds the key for a variant of `base`, written either flat ("apples_one") or nested ({ apples: { one } }).
   */
  function variant(base: string, suffix: string): string | undefined {
    const flat = `${base}_${suffix}`;
    if (templates.has(flat)) return flat;
    const nested = `${base}.${suffix}`;
    if (templates.has(nested)) return nested;
  }

  return function lookup(selector: string, options?: TOptions): string {
    if (options) {
      // Handle count (pluralization) and context. Keys become "key_context_pluralization".
      // A missing variant falls back to the key without it.
      const context = get(options.context);
      if (context != null) {
        selector = variant(selector, String(context)) ?? selector;
      }
      const count = get(options.count);
      if (count != null) {
        // Prefer an exact number key if there is one (e.g. "myExampleKey_(=2)" when count is 2).
        const ordinal = !!get(options.ordinal);
        const prefix = ordinal ? "ordinal_" : "";
        const category = prefix + getPluralRules(ordinal).select(count);
        selector = variant(selector, `${prefix}(=${count})`) ?? variant(selector, category) ?? selector;
      }
    }

    const template = templates.get(selector);
    if (!template) return selector;

    let output = "";

    for (let i = 0; i < template.length; i++) {
      output += template[i](options, formatters, locale);
    }

    return output;
  };
}

/**
 * Compiles an object of translated strings into a set of function templates.
 */
export function compile(strings: { [key: string]: any }, path: string[] = []): [string, CompiledTemplate][] {
  const entries: [string, CompiledTemplate][] = [];

  for (const key in strings) {
    switch (typeof strings[key]) {
      case "string":
        entries.push([[...path, key].join("."), parseTemplate(strings[key])]);
        break;
      case "object": {
        if (strings[key] === null || Array.isArray(strings[key])) {
          throw new Error(
            `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeof strings[key]}`,
          );
        }
        entries.push(...compile(strings[key], [...path, key]));
        break;
      }
      default:
        throw new Error(
          `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeof strings[key]}`,
        );
    }
  }

  return entries;
}

export type TemplateSegmentFn = (
  options: Record<string, any> | undefined,
  formatters: Map<string, Formatter>,
  locale: string,
) => string;

export type CompiledTemplate = TemplateSegmentFn[];

/**
 * Converts a formatter option written in a template to the type `Intl` APIs expect.
 * "true"/"false" become booleans and numeric strings become numbers; anything else stays a string.
 */
function parseOptionValue(value: string): string | number | boolean {
  if (value === "true") return true;
  if (value === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(value)) return Number(value);
  return value;
}

/**
 * Parse a string template into an array of functions that will produce each piece of the output when called.
 */
// Unknown formatter names that were already reported, so each is reported once.
const warnedFormatters = new Set<string>();

export function parseTemplate(template: string): CompiledTemplate {
  const tokens = template.split(/(\{\{.*?\}\})/g);
  const segments: TemplateSegmentFn[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (!token) continue;

    if (token.startsWith("{{") && token.endsWith("}}")) {
      const inner = token.slice(2, -2).trim();
      const parts = inner.split("|").map((p) => p.trim());

      const name = parts[0];
      const parsedFormats: { name: string; options: Record<string, string | number | boolean> }[] = [];

      // Parse formatters at build-time to prevent string splitting on every render
      for (let j = 1; j < parts.length; j++) {
        const formatStr = parts[j];
        const match = formatStr.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/);

        if (match) {
          const formatName = match[1];
          const optionsStr = match[2];
          const optsObj: Record<string, string | number | boolean> = {};

          if (optionsStr) {
            const pairs = optionsStr.split(",");
            for (let k = 0; k < pairs.length; k++) {
              const pair = pairs[k];
              const colonIndex = pair.indexOf(":");
              if (colonIndex > -1) {
                optsObj[pair.slice(0, colonIndex).trim()] = parseOptionValue(pair.slice(colonIndex + 1).trim());
              }
            }
          }
          parsedFormats.push({ name: formatName, options: optsObj });
        } else {
          parsedFormats.push({ name: formatStr, options: {} });
        }
      }

      // Push the dynamic closure
      segments.push((options, formatters, locale) => {
        // Evaluate and track the specific option at runtime.
        // This code runs in the t() computed context.
        let value = options ? get(options[name]) : undefined;

        for (let k = 0; k < parsedFormats.length; k++) {
          const fmt = parsedFormats[k];
          const formatterFn = formatters.get(fmt.name);
          if (formatterFn) {
            value = formatterFn(locale, value, fmt.options);
          } else if (!warnedFormatters.has(fmt.name)) {
            warnedFormatters.add(fmt.name);
            console.warn(
              `[dolla:translate] Unknown formatter "${fmt.name}" in a template. The value is shown unformatted.`,
            );
          }
        }

        return value != null ? String(value) : "";
      });
    } else {
      // Push a static closure that just returns the token
      segments.push(() => token);
    }
  }

  return segments;
}
