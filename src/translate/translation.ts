import { deepEqual } from "../utils.js";
import { Formatter } from "./store.js";
import { compile, SegmentType, type StringTemplate } from "./template.js";

// ----- Types ----- //

/**
 * A JSON object of translated strings. Values can be string templates or nested objects.
 */
export interface LocalizedStrings extends Record<string, string | LocalizedStrings> {}

/**
 * A function that returns an object of localized strings.
 */
export type TranslationFetchFn = () => LocalizedStrings | Promise<LocalizedStrings>;

// ----- Code ----- //

export class Translation {
  isLoaded = false;

  locale: string;
  formatters: Map<string, Formatter>;
  fetch: TranslationFetchFn;

  /**
   * Compiled templates.
   */
  templates = new Map<string, StringTemplate>();

  /**
   * Cached template outputs and the values that created them.
   */
  cache = new Map<string, [{ values: Record<string, any> | undefined; output: string }]>();

  constructor(locale: string, formatters: Map<string, Formatter>, fetch: TranslationFetchFn) {
    this.locale = locale;
    this.formatters = formatters;
    this.fetch = fetch;
  }

  async load(): Promise<void> {
    if (this.isLoaded) return;

    const strings = await this.fetch();

    const entries = compile(strings);
    for (const entry of entries) {
      this.templates.set(entry[0], entry[1]);
    }
  }

  unload() {
    this.cache.clear();
  }

  getTemplate(selector: string): StringTemplate {
    return (
      this.templates.get(selector) ?? {
        segments: [{ type: SegmentType.Static, text: `[MISSING: ${selector}]` }],
      }
    );
  }

  hasTemplate(selector: string): boolean {
    return this.templates.has(selector);
  }

  getCached(key: string, values?: Record<string, any>): string | undefined {
    const entries = this.cache.get(key);
    if (entries) {
      for (const entry of entries) {
        if (deepEqual(entry.values, values)) {
          return entry.output;
        }
      }
    }
  }

  getValue(selector: string, options: Record<string, any>): string {
    const cached = this.getCached(selector, options);
    if (cached) return cached;

    // Handle count (pluralization) and context. Keys become "key_context_pluralization".

    if (options.context != null) {
      selector += "_" + options.context;
    }
    if (options.count != null) {
      if (options.ordinal) {
        // Try to match the exact number key if there is one (e.g. "myExampleKey_ordinal_(=2)" when count is 2).
        const exact = `${selector}_ordinal_(=${options.count})`;
        if (this.hasTemplate(exact)) {
          selector = exact;
        } else {
          selector += "_ordinal_" + new Intl.PluralRules(this.locale, { type: "ordinal" }).select(options.count);
        }
      } else {
        // Try to match the exact number key if there is one (e.g. "myExampleKey_(=2)" when count is 2).
        const exact = `${selector}_(=${options.count})`;
        if (this.hasTemplate(exact)) {
          selector = exact;
        } else {
          selector += "_" + new Intl.PluralRules(this.locale).select(options.count);
        }
      }
    }

    const template = this.getTemplate(selector);
    let output = "";

    for (const segment of template.segments) {
      if (segment.type === SegmentType.Static) {
        output += segment.text;
      } else if (segment.type === SegmentType.Variable) {
        let value = this.resolve(options, segment.name);

        const formats = options.formatOverrides?.[segment.name] ?? [...segment.formats];

        if (segment.name === "count" && formats.length === 0) {
          formats.push({ name: "number", options: {} });
        }

        for (const format of formats) {
          const fn = this.formatters.get(format.name);
          if (fn == null) {
            throw new Error(
              `Failed to load format '${format.name}' when processing '${selector}', template: ${template}`,
            );
          }
          value = fn(this.locale, value, format.options);
        }

        output += value;
      }
    }

    return output;
  }

  resolve(object: any, key: string) {
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
}
