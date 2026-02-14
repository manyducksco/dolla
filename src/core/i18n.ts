import { isFunction, isObject, isString, typeOf } from "../typeChecking.js";
import { deepEqual } from "../utils.js";
import { createLogger, type Logger } from "./logger.js";
import { atom, combined, compose, get, type Gettable, type Getter } from "./signal.js";

export const I18N = Symbol("I18N");

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

export type I18nOptions = {
  /**
   * Default locale to load on startup
   */
  locale?: string | null;

  translations: TranslationConfig[];

  formatters?: Record<string, Formatter>;
};

export type TOptions = {
  /**
   *
   */
  count?: Gettable<number>;

  /**
   *
   */
  context?: Gettable<string>;

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
  formatOverrides?: Gettable<Record<string, Record<string, Format[]>>>;

  [value: string]: Gettable<any>;
};

export type Formatter = (locale: string, value: any, options: Record<string, any>) => string;

type BuiltInFormatters = {
  number: [number | bigint, Intl.NumberFormatOptions?];
  datetime: [Date, Intl.DateTimeFormatOptions?];
  list: [Iterable<string>, Intl.ListFormatOptions?];
};

// ----- Code ----- //

class Translation {
  config: TranslationConfig;

  #isLoaded = false;

  #templates = new Map<string, StringTemplate>();

  constructor(config: TranslationConfig) {
    this.config = config;
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

export type I18nAPI = ReturnType<I18n["api"]>;

/**
 * Dolla's I(nternationalizatio)n module. Manages language translations and locale-based formatting.
 */
export class I18n {
  #logger: Logger;
  #translations = new Map<string, Translation>();
  #cache: [key: string, values: Record<string, any> | undefined, output: string][] = [];
  #formatters = new Map<string, Formatter>();

  #initialLocale = "auto";

  #locale = combined(atom("en"));

  get locale() {
    return this.#locale.get;
  }

  get locales() {
    return [...this.#translations.keys()];
  }

  constructor(options: I18nOptions) {
    this.#logger = createLogger("dolla.i18n");

    // Convert languages into Language instances.
    options.translations.forEach((entry) => {
      this.#translations.set(entry.locale, new Translation(entry));
    });

    if (options.locale && options.locale !== "auto") {
      this.#initialLocale = options.locale;
    }

    this.#logger.info(
      `${this.#translations.size} language${this.#translations.size === 1 ? "" : "s"} supported: '${[...this.#translations.keys()].join("', '")}'`,
    );

    this.#formatters.set("number", (locale, value, options) => {
      return new Intl.NumberFormat(locale, options).format(value);
    });
    this.#formatters.set("datetime", (locale, value, options) => {
      return new Intl.DateTimeFormat(locale, options).format(value);
    });
    this.#formatters.set("list", (locale, value, options) => {
      return new Intl.ListFormat(locale, options).format(value);
    });

    if (options.formatters) {
      for (const key in options.formatters) {
        this.#formatters.set(key, options.formatters[key]);
      }
    }
  }

  async mount() {
    if (this.#translations.size > 0) {
      await this.setLocale(this.#initialLocale);
    }
  }

  unmount() {
    // TODO: do any necessary cleanup
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
      this.#locale.set(realName);

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
  t(selector: string, options?: TOptions): Getter<string> {
    return compose(() => {
      const values: Record<string, any> = {};

      // Track all option values.
      for (const key in options) {
        values[key] = get(options[key]);
      }

      return this.#getValue(this.locale(), selector, values);
    });
  }

  format<K extends keyof BuiltInFormatters, V extends BuiltInFormatters[K][0], O extends BuiltInFormatters[K][1]>(
    name: K,
    value: Gettable<V>,
    options?: O,
  ): Getter<string>;

  format<V, O>(name: string, value: Gettable<V>, options?: O): Getter<string>;

  format(name: string, value: any, options?: Record<string, any>): Getter<string> {
    const callback = this.#formatters.get(name);
    if (!callback) {
      throw new Error(`Unknown format: ${name}`);
    }

    return compose(() => callback(get(this.locale), get(value), options ?? {}));
  }

  api() {
    return {
      t: this.t.bind(this),
      setLocale: this.setLocale.bind(this),
      format: this.format.bind(this),
    };
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
          const fn = this.#formatters.get(format.name);
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
