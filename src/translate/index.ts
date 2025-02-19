import type { Dolla, Logger } from "../core/dolla.js";
import { atom, compose, get, type MaybeReactive, type Reactive } from "../core/signals.js";
import { isFunction, isObject, isString, typeOf } from "../typeChecking.js";
import { deepEqual } from "../utils.js";

// ----- Types ----- //

/**
 * A JSON object of translated strings. Values can be string templates or nested objects.
 */
interface LocalizedStrings extends Record<string, string | LocalizedStrings> {}

enum SegmentType {
  Static,
  Variable,
}
type StringTemplate = { segments: (StaticSegment | VariableSegment)[] };
/**
 * A string segment with literal text to be appended without processing.
 */
type StaticSegment = {
  type: SegmentType.Static;
  text: string;
};
/**
 * A variable passed to the t() function. Needs to be formatted before it is appended.
 */
type VariableSegment = {
  type: SegmentType.Variable;
  name: string;
  formats: Format[];
};
/**
 * A formatter to be applied to a variable.
 */
type Format = {
  name: string;
  options: Record<string, any>;
};

export interface TranslationConfig {
  /**
   * Name of the locale this translation is for (BCP 47 locale names recommended).
   */
  locale: string;

  /**
   * An object with translated strings for this language.
   */
  strings?: LocalizedStrings;

  /**
   * A callback function that returns a Promise that resolves to the translation object for this language.
   */
  fetch?: () => Promise<LocalizedStrings>;

  /**
   * Path to a JSON file with translated strings for this language.
   */
  path?: string;
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
  count?: MaybeReactive<number>;

  /**
   *
   */
  context?: MaybeReactive<string>;

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
  formatOverrides?: MaybeReactive<Record<string, Record<string, Format[]>>>;

  [value: string]: MaybeReactive<any>;
};

export type Formatter = (locale: string, value: unknown, options: Record<string, any>) => string;

// ----- Code ----- //

class Translation {
  dolla: Dolla;
  config: TranslationConfig;

  #isLoaded = false;

  #templates = new Map<string, StringTemplate>();

  constructor(config: TranslationConfig, dolla: Dolla) {
    this.config = config;
    this.dolla = dolla;
  }

  async load(): Promise<void> {
    let strings: LocalizedStrings | undefined;

    if (!this.#isLoaded) {
      if (isObject(this.config.strings)) {
        strings = this.config.strings;
      } else if (isFunction(this.config.fetch)) {
        strings = await this.config.fetch();
        if (!isObject(strings)) {
          throw new Error(`Fetch function did not return an object of language strings: ${strings}`);
        }
      } else if (isString(this.config.path)) {
        const res = await fetch(this.config.path);
        if (res.ok) {
          const body = await res.json();
          if (isObject(body)) {
            strings = body as LocalizedStrings;
          } else {
            throw new Error(
              `Language path '${this.config.path}' did not return an object of language strings: ${body}`,
            );
          }
        } else {
          throw new Error(`HTTP request failed.`);
        }
      }
    }

    if (strings) {
      const entries = this.#compile(strings);
      for (const entry of entries) {
        this.#templates.set(entry[0], entry[1]);
      }
    } else {
      throw new Error(`Language could not be loaded.`);
    }
  }

  getTemplate(selector: string): StringTemplate {
    return (
      this.#templates.get(selector) ?? {
        segments: [{ type: SegmentType.Static, text: `[MISSING: ${selector}]` }],
      }
    );
  }

  hasTemplate(selector: string): boolean {
    return this.#templates.has(selector);
  }

  #compile(strings: { [key: string]: any }, path: string[] = []): [string, StringTemplate][] {
    const entries: [string, StringTemplate][] = [];

    for (const key in strings) {
      switch (typeOf(strings[key])) {
        case "string":
          entries.push([[...path, key].join("."), this.#parseTemplate(strings[key])]);
          break;
        case "object":
          entries.push(...this.#compile(strings[key], [...path, key]));
          break;
        default:
          throw new Error(
            `Expected to find a string or object at ${[...path, key].join(".")}. Got: ${typeOf(strings[key])}`,
          );
      }
    }

    return entries;
  }

  #parseTemplate(template: string): StringTemplate {
    // "{{itemName}} costs {{amount | number(style: currency, currency: USD)}}."

    enum Loc {
      /**
       * Outside value braces.
       */
      Static,
      /**
       * Inside value braces; currently parsing the name of the value. e.g. `{{ [name] | number(style: currency, currency: USD) }}`
       */
      ValueName,
      /**
       * Inside value braces; currently parsing the name of a format function. e.g. `{{ name | [number](style: currency, currency: USD) }}`
       */
      FormatName,
      /**
       * Inside value braces; currently parsing the name of a format option. e.g. `{{ name | number([style]: currency, currency: USD) }}`
       */
      FormatOptionName,
      /**
       * Inside value braces; currently parsing the value of a format option. e.g. `{{ name | number(style: [currency], currency: USD ) }}`
       */
      FormatOptionValue,
      /**
       * Inside value braces; just reached the closing bracket of a format option. e.g. `{{ name | number(style: [currency], currency: USD) [] }}`
       */
      FormatOptionEnd,
    }

    const parsed: StringTemplate = {
      segments: [],
    };

    let buffer = "";
    let i = 0;
    let loc: Loc = Loc.Static;
    let segment!: VariableSegment;
    let format!: VariableSegment["formats"][0];

    let formatOptionName!: string;

    const startSegment = () => {
      segment = {
        type: SegmentType.Variable,
        name: "",
        formats: [],
      };
    };

    const startFormat = () => {
      format = {
        name: "",
        options: {},
      };
    };

    while (i < template.length) {
      // Skip spaces (unless we're in static)
      if (loc !== Loc.Static && template[i] === " ") {
        i++;
        continue;
      }

      switch (loc) {
        case Loc.Static:
          if (template[i] === "{" && template[i + 1] === "{") {
            loc = Loc.ValueName;
            i += 2;
            // close static segment
            if (buffer.length > 0) {
              parsed.segments.push({ type: SegmentType.Static, text: buffer });
              buffer = "";
            }
            startSegment();
          } else {
            buffer += template[i];
            i++;
          }
          break;
        case Loc.ValueName:
          if (template[i] === "|") {
            loc = Loc.FormatName;
            i += 1;
            // add name to value segment
            segment.name = buffer;
            buffer = "";
            startFormat();
          } else if (template[i] === "}" && template[i + 1] === "}") {
            loc = Loc.Static;
            i += 2;
            // close value segment
            segment.name = buffer;
            buffer = "";
            parsed.segments.push(segment);
          } else {
            buffer += template[i];
            i++;
          }
          break;
        case Loc.FormatName:
          if (template[i] === "(") {
            loc = Loc.FormatOptionName;
            i += 1;
            // add name to format object
            format.name = buffer;
            buffer = "";
          } else if (template[i] === "}" && template[i + 1] === "}") {
            loc = Loc.Static;
            i += 2;
            // close format and value segment
            segment.formats.push(format);
            parsed.segments.push(segment);
          } else {
            buffer += template[i];
            i++;
          }
          break;
        case Loc.FormatOptionName:
          if (template[i] === ")") {
            // TODO: error - no value provided for option
          } else if (template[i] === ":") {
            loc = Loc.FormatOptionValue;
            i += 1;
            // add name to format option object
            formatOptionName = buffer;
            buffer = "";
          } else if (template[i] === "}" && template[i + 1] === "}") {
            // TODO: error - format options parenthesis not closed
          } else {
            buffer += template[i];
            i++;
          }
          break;
        case Loc.FormatOptionValue:
          if (template[i] === ")") {
            loc = Loc.FormatOptionEnd;
            i += 1;
            // add value to format option object
            // add format option to format object; we're done with this format
            format.options[formatOptionName] = buffer;
            buffer = "";
            segment.formats.push(format);
          } else if (template[i] === ",") {
            loc = Loc.FormatOptionName;
            i += 1;
            // add value to format option object
            // add format option to format object; we're adding another option
            format.options[formatOptionName] = buffer;
            buffer = "";
          } else if (template[i] === "}" && template[i + 1] === "}") {
            // TODO: error - format options parenthesis not closed
          } else {
            buffer += template[i];
            i++;
          }
          break;
        case Loc.FormatOptionEnd:
          if (template[i] === "|") {
            loc = Loc.FormatName;
            i += 1;
            startFormat();
          } else if (template[i] === "}" && template[i + 1] === "}") {
            loc = Loc.Static;
            i += 2;
            // add value segment
            parsed.segments.push(segment);
          } else {
            // TODO: error - no other valid characters
          }
          break;
      }
    }

    if (loc === Loc.Static && buffer.length > 0) {
      parsed.segments.push({ type: SegmentType.Static, text: buffer });
    }

    return parsed;
  }
}

/**
 * Dolla's I(nternationalizatio)n module. Manages language translations and locale-based formatting.
 */
export class I18n {
  #dolla: Dolla;
  #logger: Logger;
  #translations = new Map<string, Translation>();
  #cache: [key: string, values: Record<string, any> | undefined, output: string][] = [];
  #formats = new Map<string, Formatter>();

  #initialLocale = "auto";

  #locale = atom<string>("");
  get locale() {
    return this.#locale;
  }

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("Dolla.i18n");

    this.addFormat("number", (_, value, options) => {
      return this.#formatNumber(Number(value), options);
    });
    this.addFormat("datetime", (_, value, options) => {
      return this.#formatDateTime(value as any, options);
    });
    this.addFormat("list", (_, value, options) => {
      return this.#formatList(value as any, options);
    });

    /**
     * Load language before the app mounts.
     */
    dolla.beforeMount(async () => {
      if (this.#translations.size > 0) {
        await this.setLocale(this.#initialLocale);
      }
    });
  }

  get locales() {
    return [...this.#translations.keys()];
  }

  setup(options: I18nSetupOptions) {
    // Convert languages into Language instances.
    options.translations.forEach((entry) => {
      this.#translations.set(entry.locale, new Translation(entry, this.#dolla));
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
      `${this.#translations.size} language${this.#translations.size === 1 ? "" : "s"} supported: '${[...this.#translations.keys()].join("', '")}'`,
    );
  }

  async setLocale(name: string) {
    let realName!: string;

    if (name === "auto") {
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
        if (this.#translations.has(name)) {
          // Found a matching language.
          realName = name;
        }
      }
    } else {
      // Tag is the actual tag to set.
      if (this.#translations.has(name)) {
        realName = name;
      }
    }

    if (realName == null) {
      const firstLanguage = this.#translations.keys().next().value;
      if (firstLanguage) {
        realName = firstLanguage;
      }
    }

    if (!realName || !this.#translations.has(realName)) {
      throw new Error(`Locale '${name}' has no translation.`);
    }

    const translation = this.#translations.get(realName)!;

    try {
      await translation.load();

      this.#cache = [];
      this.#locale.value = realName;

      this.#logger.info("set language to " + realName);
    } catch (error) {
      if (error instanceof Error) {
        this.#logger.crash(error);
      }
    }
  }

  /**
   * Returns a State containing the value at `key`.

   * @param selector - Key to the translated value.
   * @param options - A map of `{{placeholder}}` names and the values to replace them with.
   *
   * @example
   * const $value = t("your.key.here", { count: 5 });
   */
  t(selector: string, options?: TOptions): Reactive<string> {
    if (this === undefined) {
      throw new Error(
        `The 't' function cannot be destructured. If you need a standalone version you can import it like so: 'import { t } from "@manyducks.co/dolla"'`,
      );
    }

    return compose(() => {
      const values: Record<string, any> = {};

      // Track all option values.
      for (const key in options) {
        values[key] = get(options[key]);
      }

      return this.#getValue(get(this.#locale), selector, values);
    });
  }

  #getValue(locale: string, selector: string, options: Record<string, any>): string {
    const cached = this.#getCached(selector, options);
    if (cached) return cached;

    const translation = this.#translations.get(locale)!;

    // Handle count (pluralization) and context. Keys become "key_context_pluralization".

    if (options.context != null) {
      selector += "_" + options.context;
    }
    if (options.count != null) {
      if (options.ordinal) {
        // Try to match the exact number key if there is one (e.g. "myExampleKey_ordinal_(=2)" when count is 2).
        const exact = `${selector}_ordinal_(=${options.count})`;
        if (translation.hasTemplate(exact)) {
          selector = exact;
        } else {
          selector += "_ordinal_" + new Intl.PluralRules(locale, { type: "ordinal" }).select(options.count);
        }
      } else {
        // Try to match the exact number key if there is one (e.g. "myExampleKey_(=2)" when count is 2).
        const exact = `${selector}_(=${options.count})`;
        if (translation.hasTemplate(exact)) {
          selector = exact;
        } else {
          selector += "_" + new Intl.PluralRules(locale).select(options.count);
        }
      }
    }

    const template = translation.getTemplate(selector);
    let output = "";

    for (const segment of template.segments) {
      if (segment.type === SegmentType.Static) {
        output += segment.text;
      } else if (segment.type === SegmentType.Variable) {
        let value = resolve(options, segment.name);

        const formats = options.formatOverrides?.[segment.name] ?? [...segment.formats];

        if (segment.name === "count" && formats.length === 0) {
          formats.push({ name: "number", options: {} });
        }

        for (const format of formats) {
          const fn = this.#formats.get(format.name);
          if (fn == null) {
            const error = new Error(
              `Failed to load format '${format.name}' when processing '${selector}', template: ${template}`,
            );
            this.#logger.crash(error);
            throw error;
          }
          value = fn(locale, value, format.options);
        }

        output += value;
      }
    }

    return output;
  }

  /**
   * Add a custom format callback.
   *
   * @example
   * Dolla.i18n.addFormat("uppercase", (locale, value, options) => {
   *   return value.toUpperCase();
   * });
   *
   * {
   *   "greeting": "Hello, {{name|uppercase}}!"
   * }
   *
   * t("greeting", {name: "world"}); // State<"Hello, WORLD!">
   */
  addFormat(name: string, callback: (locale: string, value: unknown, options: Record<string, any>) => string) {
    this.#formats.set(name, callback);
  }

  /**
   * Creates an `Intl.Collator` configured for the current locale.
   * NOTE: The Collator remains bound to the locale it was created with, even when the app's locale changes.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator#options
   */
  collator(options?: Intl.CollatorOptions) {
    return new Intl.Collator(this.#locale.value, options);
  }

  /**
   * Formats a number for the current locale. Uses `Intl.NumberFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat#options
   */
  number(count: MaybeReactive<number | bigint>, options?: Intl.NumberFormatOptions): Reactive<string> {
    return compose(() => {
      get(this.#locale); // track to update when locale changes
      return this.#formatNumber(get(count), options);
    });
  }

  #formatNumber(count: number | bigint, options?: Intl.NumberFormatOptions): string {
    return new Intl.NumberFormat(this.#locale.value, options).format(count);
  }

  /**
   * Formats a date for the current locale. Uses `Intl.DateTimeFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
   *
   * @example
   * const date = new Date();
   * const $formatted = Dolla.i18n.dateTime(date, { dateFormat: "short" });
   */
  dateTime(
    date?: MaybeReactive<string | number | Date | undefined>,
    options?: Intl.DateTimeFormatOptions,
  ): Reactive<string> {
    return compose(() => {
      get(this.#locale); // track to update when locale changes
      return this.#formatDateTime(get(date), options);
    });
  }

  #formatDateTime(date?: string | number | Date, options?: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat(this.#locale.value, options).format(isString(date) ? new Date(date) : date);
  }

  /**
   * Formats a list for the current locale. Uses `Intl.ListFormat` under the hood.
   *
   * @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/DateTimeFormat/DateTimeFormat#options
   *
   * @example
   * const list = new Date();
   * const $formatted = Dolla.i18n.list(list, {  });
   */
  list(list: MaybeReactive<Iterable<string>>, options?: Intl.ListFormatOptions): Reactive<string> {
    return compose(() => {
      get(this.#locale); // track to update when locale changes
      return this.#formatList(get(list), options);
    });
  }

  #formatList(list: Iterable<string>, options?: Intl.ListFormatOptions): string {
    return new Intl.ListFormat(this.#locale.value, options).format(list);
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
