import { assertObject, isFunction, isObject, isPromise, typeOf } from "@borf/bedrock";
import { computed, readable, writable, type Readable } from "../state.js";
import { type StoreContext } from "../store.js";
import { type Stringable } from "../types.js";
import { deepEqual } from "../utils.js";

// ----- Types ----- //

// TODO: Is there a good way to represent infinitely nested recursive types?
/**
 * An object where values are either a translated string or another nested Translation object.
 */
type Translation = Record<string, string | Record<string, string | Record<string, string | Record<string, string>>>>;

export interface LanguageConfig {
  /**
   * The translated strings for this language, or a callback function that returns them.
   */
  translation: Translation | (() => Translation) | (() => Promise<Translation>);
}

type LanguageOptions = {
  /**
   * Languages supported by the app (as added with App.language())
   */
  languages: {
    [tag: string]: LanguageConfig;
  };

  /**
   * Default language to load on startup
   */
  currentLanguage?: string;
};

// ----- Code ----- //

export function LanguageStore(ctx: StoreContext<LanguageOptions>) {
  ctx.name = "dolla/language";

  const languages = new Map<string, Language>();

  // Convert languages into Language instances.
  Object.entries(ctx.options.languages).forEach(([tag, config]) => {
    languages.set(tag, new Language(tag, config));
  });

  ctx.info(
    `App supports ${languages.size} language${languages.size === 1 ? "" : "s"}: '${[...languages.keys()].join("', '")}'`
  );

  const $$isLoaded = writable(false);
  const $$language = writable<string | undefined>(undefined);
  const $$translation = writable<Translation | undefined>(undefined);

  // Fallback labels for missing state and data.
  const $noLanguageValue = readable("[NO LANGUAGE SET]");

  // Cache readable translations by key and values.
  // Return a cached one instead of creating a new, identical mapped value.
  // The same keys are typically used in many places across the app.

  // TODO: Keep an eye on this for memory leaks. Keeping a bunch of unused alternates with varied values might be an issue.
  const translationCache: [
    key: string,
    values: Record<string, Stringable | Readable<Stringable>> | undefined,
    readable: Readable<string>
  ][] = [];

  function getCached(
    key: string,
    values?: Record<string, Stringable | Readable<Stringable>>
  ): Readable<string> | undefined {
    for (const entry of translationCache) {
      if (entry[0] === key && deepEqual(entry[1], values)) {
        return entry[2];
      }
    }
  }

  /**
   * Replaces {{placeholders}} with values in translated strings.
   */
  function replaceMustaches(template: string, values: Record<string, Stringable>) {
    for (const name in values) {
      template = template.replace(`{{${name}}}`, String(values[name]));
    }
    return template;
  }

  // TODO: Determine and load default language.
  const currentLanguage = ctx.options.currentLanguage
    ? languages.get(ctx.options.currentLanguage)
    : languages.get([...languages.keys()][0]);

  if (currentLanguage == null) {
    $$isLoaded.set(true);
  } else {
    ctx.info(`Current language is '${currentLanguage.tag}'.`);

    currentLanguage.getTranslation().then((translation) => {
      $$language.set(currentLanguage.tag);
      $$translation.set(translation);

      $$isLoaded.set(true);
    });
  }

  return {
    $isLoaded: readable($$isLoaded),
    $currentLanguage: readable($$language),
    supportedLanguages: [...languages.keys()],

    async setLanguage(tag: string) {
      if (!languages.has(tag)) {
        throw new Error(`Language '${tag}' is not supported.`);
      }

      const lang = languages.get(tag)!;

      try {
        const translation = await lang.getTranslation();

        $$translation.set(translation);
        $$language.set(tag);

        ctx.info("set language to " + tag);
      } catch (error) {
        if (error instanceof Error) {
          ctx.crash(error);
        }
      }
    },

    /**
     * Returns a Readable of the translated value.

     * @param key - Key to the translated value.
     * @param values - A map of {{placeholder}} names and the values to replace them with.
     */
    translate(key: string, values?: Record<string, Stringable | Readable<Stringable>>): Readable<string> {
      if (!$$language.get()) {
        return $noLanguageValue;
      }

      const cached = getCached(key, values);
      if (cached) {
        return cached;
      }

      if (values) {
        const readableValues: Record<string, Readable<any>> = {};

        for (const [key, value] of Object.entries<any>(values)) {
          if (typeof value?.observe === "function") {
            readableValues[key] = value;
          }
        }

        // This looks extremely weird, but it creates a joined state
        // that contains the translation with interpolated observable values.
        const readableEntries = Object.entries(readableValues);
        if (readableEntries.length > 0) {
          const $merged = computed([$$translation, ...readableEntries.map((x) => x[1])], ([t, ...entryValues]) => {
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

          translationCache.push([key, values, $merged]);

          return $merged;
        }
      }

      const $replaced = computed($$translation, (t) => {
        let result = resolve(t, key) || `[NO TRANSLATION: ${key}]`;

        if (values) {
          result = replaceMustaches(result, values);
        }

        return result;
      });

      translationCache.push([key, values, $replaced]);

      return $replaced;
    },
  };
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

class Language {
  #tag;
  #config;
  #translation?: Translation;

  get tag() {
    return this.#tag;
  }

  constructor(tag: string, config: LanguageConfig) {
    this.#tag = tag;
    this.#config = config;
  }

  async getTranslation() {
    if (!this.#translation) {
      // Translation can be an object of strings, a function that returns one, or an async function that resolves to one.
      if (isFunction(this.#config.translation)) {
        const result = this.#config.translation();

        if (isPromise(result)) {
          const resolved = await result;

          assertObject(
            resolved,
            `Translation promise of language '${
              this.#tag
            }' must resolve to an object of translated strings. Got type: %t, value: %v`
          );

          this.#translation = resolved;
        } else if (isObject(result)) {
          this.#translation = result;
        } else {
          throw new TypeError(
            `Translation function of '${this.#tag}' must return an object or promise. Got type: ${typeOf(
              result
            )}, value: ${result}`
          );
        }
      } else if (isObject(this.#config.translation)) {
        this.#translation = this.#config.translation;
      } else {
        throw new TypeError(
          `Translation of '${
            this.#tag
          }' must be an object of translated strings, a function that returns one, or an async function that resolves to one. Got type: ${typeOf(
            this.#config.translation
          )}, value: ${this.#config.translation}`
        );
      }
    }

    return this.#translation;
  }
}
