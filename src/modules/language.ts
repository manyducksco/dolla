import { createSignal, derive, isSignal, signalify, type Signal } from "../signals.js";
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

export interface LanguageConfig {
  name: string;

  /**
   * Path to a JSON file with translated strings for this language.
   */
  path?: string;

  /**
   * A callback function that returns a Promise that resolves to the translation object for this language.
   */
  fetch?: () => Promise<LocalizedStrings>;
}

export type LanguageSetupOptions = {
  /**
   * Default language to load on startup
   */
  initialLanguage?: string | null;

  languages: LanguageConfig[];
};

// ----- Code ----- //

class Localization {
  dolla: Dolla;
  config: LanguageConfig;
  strings?: LocalizedStrings;

  constructor(config: LanguageConfig, dolla: Dolla) {
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

export class Language {
  #dolla: Dolla;
  #logger: Logger;
  #localizations = new Map<string, Localization>();
  #cache: [
    key: string,
    values: Record<string, Stringable | Signal<Stringable>> | undefined,
    readable: Signal<string>,
  ][] = [];

  #initialLanguage = "auto";

  $current: Signal<string | undefined>;
  #setCurrent;
  #$strings;
  #setStrings;

  constructor(dolla: Dolla) {
    this.#dolla = dolla;
    this.#logger = dolla.createLogger("dolla/language");

    const [$current, setCurrent] = createSignal<string>();
    const [$strings, setStrings] = createSignal<LocalizedStrings>();

    this.$current = $current;
    this.#setCurrent = setCurrent;
    this.#$strings = $strings;
    this.#setStrings = setStrings;

    /**
     * Load language before the app mounts.
     */
    dolla.beforeMount(async () => {
      if (this.#localizations.size > 0) {
        await this.setLanguage(this.#initialLanguage);
      }
    });
  }

  get supportedLanguages() {
    return [...this.#localizations.keys()];
  }

  setup(options: LanguageSetupOptions) {
    // Convert languages into Language instances.
    options.languages.forEach((entry) => {
      this.#localizations.set(entry.name, new Localization(entry, this.#dolla));
    });

    // Check that initialLanguage is actually registered.
    if (options.initialLanguage && options.initialLanguage !== "auto") {
      const isRegistered = options.languages.some((entry) => entry.name === options.initialLanguage);
      if (!isRegistered) {
        throw new Error(`Initial language '${options.initialLanguage}' has no registered translation.`);
      }
      this.#initialLanguage = options.initialLanguage;
    }

    this.#logger.info(
      `${this.#localizations.size} language${this.#localizations.size === 1 ? "" : "s"} supported: '${[...this.#localizations.keys()].join("', '")}'`,
    );
  }

  async setLanguage(name: string) {
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

      this.#setStrings(translation);
      this.#setCurrent(realName);

      this.#logger.info("set language to " + realName);
    } catch (error) {
      if (error instanceof Error) {
        this.#logger.crash(error);
      }
    }
  }

  /**
   * Returns a Signal containing the value at `key`.
  
   * @param key - Key to the translated value.
   * @param values - A map of {{placeholder}} names and the values to replace them with.
   */
  t(key: string, values?: Record<string, Stringable | Signal<Stringable>>): Signal<string> {
    if (this === undefined) {
      throw new Error(
        `The 't' function cannot be destructured. If you need a standalone version you can import it like so: 'import { t } from "@manyducks.co/dolla"'`,
      );
    }

    if (!this.$current.get()) {
      return $noLanguageValue;
    }

    const cached = this.#getCached(key, values);
    if (cached) {
      return cached;
    }

    if (values) {
      const signalValues: Record<string, Signal<any>> = {};

      for (const [key, value] of Object.entries<any>(values)) {
        if (isSignal(value)) {
          signalValues[key] = value;
        }
      }

      // This looks extremely weird, but it creates a joined state
      // that contains the translation with interpolated observable values.
      const readableEntries = Object.entries(signalValues);
      if (readableEntries.length > 0) {
        const readables = readableEntries.map((x) => x[1]);
        const $merged = derive([this.#$strings, ...readables], (t, ...entryValues) => {
          const entries = entryValues.map((_, i) => readableEntries[i]);
          const mergedValues = {
            ...values,
          };

          for (let i = 0; i < entries.length; i++) {
            const key = entries[i][0];
            mergedValues[key] = entryValues[i];
          }

          const result = resolve(t, key) || `[NO TRANSLATION: ${key}]`;
          return replaceMustaches(result, mergedValues);
        });

        this.#cache.push([key, values, $merged]);

        return $merged;
      }
    }

    const $replaced = derive([this.#$strings], (t) => {
      let result = resolve(t, key) || `[NO TRANSLATION: ${key}]`;

      if (values) {
        result = replaceMustaches(result, values);
      }

      return result;
    });

    this.#cache.push([key, values, $replaced]);

    return $replaced;
  }

  #getCached(key: string, values?: Record<string, Stringable | Signal<Stringable>>): Signal<string> | undefined {
    for (const entry of this.#cache) {
      if (entry[0] === key && deepEqual(entry[1], values)) {
        return entry[2];
      }
    }
  }
}

// Fallback labels for missing state and data.
const $noLanguageValue = signalify("[NO LANGUAGE SET]");

/**
 * Replaces {{placeholders}} with values in translated strings.
 */
function replaceMustaches(template: string, values: Record<string, Stringable>) {
  for (const name in values) {
    template = template.replace(`{{${name}}}`, String(values[name]));
  }
  return template;
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
