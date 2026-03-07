import { $$context, DollaPlugin } from "../core/index.js";
import { memo, state, get, type Getter, type MaybeGetter } from "../core/reactive.js";
import { typeOf } from "../typeChecking.js";

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
  /**
   *
   */
  count?: MaybeGetter<number>;

  /**
   *
   */
  context?: MaybeGetter<string>;

  [value: string]: MaybeGetter<any>;
};

export type LookupFn = (selector: string, options?: TOptions) => string;

export type Formatter = (locale: string, value: any, options: Record<string, any>) => string;

type BuiltInFormatters = {
  number: [number | bigint, Intl.NumberFormatOptions?];
  datetime: [Date, Intl.DateTimeFormatOptions?];
  list: [Iterable<string>, Intl.ListFormatOptions?];
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

  format<K extends keyof BuiltInFormatters, V extends BuiltInFormatters[K][0], O extends BuiltInFormatters[K][1]>(
    name: K,
    value: MaybeGetter<V>,
    options?: O,
  ): Getter<string>;

  format<V, O>(name: string, value: MaybeGetter<V>, options?: O): Getter<string>;
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

const TRANSLATOR = Symbol.for("Dolla.Translator");

export function createTranslate(options: TranslateOptions): DollaPlugin {
  return async function setup(context) {
    const translator = createTranslator(options);
    context.state[TRANSLATOR] = translator;
    await translator.setLocale(options.locale);
  };
}

export function $translate() {
  const translator = $$context().state[TRANSLATOR] as Translator;
  if (translator == null) {
    throw new Error("Translate plugin isn't loaded.");
  }
  return translator;
}

export function createTranslator(options: TranslateOptions): Translator {
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

  let lookup: LookupFn | undefined;

  const [currentLocale, setCurrentLocale] = state("en");
  const supportedLocales = [...Object.keys(options.translations)];

  /**
   * Loads translation for the locale.
   */
  async function setLocale(name?: string) {
    let locale!: string;

    if (name === undefined) {
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
        if (name in options.translations) {
          // Found a matching language.
          locale = name;
          break;
        }
      }
    } else {
      // Tag is the actual tag to set.
      if (name in options.translations) {
        locale = name;
      }
    }

    if (locale == null) {
      const firstLanguage = Object.keys(options.translations).at(0);
      if (firstLanguage) {
        locale = firstLanguage;
      }
    }

    if (!locale || !(locale in options.translations)) {
      throw new Error(`Locale '${name}' has no translation.`);
    }

    lookup = await createLookup(locale, formatters, options.translations[locale]);

    // Update locale string after init so t() signals will update.
    setCurrentLocale(locale);
  }

  function t(selector: string, options?: TOptions): Getter<string> {
    return memo(() => {
      currentLocale(); // track locale
      return lookup?.(selector, options) ?? selector;
    });
  }

  function format<
    K extends keyof BuiltInFormatters,
    V extends BuiltInFormatters[K][0],
    O extends BuiltInFormatters[K][1],
  >(name: K, value: MaybeGetter<V>, options?: O): Getter<string>;

  function format<V, O>(name: string, value: MaybeGetter<V>, options?: O): Getter<string>;

  function format(name: string, value: MaybeGetter<any>, options?: Record<string, any>): Getter<string> {
    const callback = formatters.get(name);
    if (!callback) {
      throw new Error(`Unknown format: ${name}`);
    }

    return memo(() => callback(currentLocale(), get(value), options ?? {}));
  }

  return {
    supportedLocales,
    currentLocale,
    setLocale,
    t,
    format,
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
  const strings = typeof translation === "function" ? await translation() : translation;
  const entries = compile(strings);
  const templates = new Map(entries);

  /**
   * Looks up the template and produces the output. Any reactive values in `options` are tracked when used.
   */
  return function lookup(selector: string, options?: TOptions): string {
    if (options) {
      // Handle count (pluralization) and context. Keys become "key_context_pluralization".
      if (options.context != null) {
        selector += "_" + options.context;
      }
      if (options.count != null) {
        if (options.ordinal) {
          // Try to match the exact number key if there is one (e.g. "myExampleKey_ordinal_(=2)" when count is 2).
          const exact = `${selector}_ordinal_(=${options.count})`;
          if (templates.has(exact)) {
            selector = exact;
          } else {
            selector += "_ordinal_" + new Intl.PluralRules(locale, { type: "ordinal" }).select(get(options.count));
          }
        } else {
          // Try to match the exact number key if there is one (e.g. "myExampleKey_(=2)" when count is 2).
          const exact = `${selector}_(=${options.count})`;
          if (templates.has(exact)) {
            selector = exact;
          } else {
            selector += "_" + new Intl.PluralRules(locale).select(get(options.count));
          }
        }
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
    switch (typeOf(strings[key])) {
      case "string":
        entries.push([[...path, key].join("."), parseTemplate(strings[key])]);
        break;
      case "object":
        entries.push(...compile(strings[key], [...path, key]));
        break;
      default:
        throw new Error(
          `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeOf(strings[key])}`,
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
 * Parse a string template into an array of functions that will produce each piece of the output when called.
 */
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
      const parsedFormats: { name: string; options: Record<string, string> }[] = [];

      // Parse formatters at build-time to prevent string splitting on every render
      for (let j = 1; j < parts.length; j++) {
        const formatStr = parts[j];
        const match = formatStr.match(/^([a-zA-Z0-9_]+)(?:\((.*)\))?$/);

        if (match) {
          const formatName = match[1];
          const optionsStr = match[2];
          const optsObj: Record<string, string> = {};

          if (optionsStr) {
            const pairs = optionsStr.split(",");
            for (let k = 0; k < pairs.length; k++) {
              const pair = pairs[k];
              const colonIndex = pair.indexOf(":");
              if (colonIndex > -1) {
                optsObj[pair.slice(0, colonIndex).trim()] = pair.slice(colonIndex + 1).trim();
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
