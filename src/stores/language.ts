// import { $, $$, isReadable, observe, type Readable } from "../state.js";
import { signal, isSignal, watch, type Signal, derive } from "../signals.js";
import { type StoreContext } from "../store.js";
import { assertObject, isFunction, isObject, isString, typeOf } from "../typeChecking.js";
import { type Stringable } from "../types.js";
import { deepEqual } from "../utils.js";

// ----- Types ----- //

// TODO: Is there a good way to represent infinitely nested recursive types?
/**
 * An object where values are either a translated string or another nested Translation object.
 */
type Translation = Record<string, string | Record<string, string | Record<string, string | Record<string, string>>>>;

export interface LanguageConfig {
  name: string;

  /**
   * Path to a JSON file with translated strings for this language, a plain object containing said translations, or a callback function that returns them.
   */
  translations: string | Translation | (() => Translation) | (() => Promise<Translation>);
}

type LanguageOptions = {
  languages: LanguageConfig[];

  /**
   * Default language to load on startup
   */
  defaultLanguage?: string;
};

// ----- Code ----- //

export function LanguageStore(ctx: StoreContext<LanguageOptions>) {
  ctx.name = "dolla/language";

  const languages = new Map<string, LanguageConfig>();
  const cache = new Map<string, Translation>();

  // Convert languages into Language instances.
  ctx.options.languages.forEach((entry) => {
    languages.set(entry.name, entry);
  });

  ctx.info(
    `App supports ${languages.size} language${languages.size === 1 ? "" : "s"}: '${[...languages.keys()].join("', '")}'`,
  );

  async function getTranslation(config: LanguageConfig) {
    if (!cache.has(config.name)) {
      let fn: () => Promise<Translation>;

      if (isString(config.translations)) {
        fn = async () => {
          return fetch(config.translations as string).then((res) => res.json());
        };
      } else if (isFunction(config.translations)) {
        fn = async () => (config.translations as () => Translation)();
      } else if (isObject(config.translations)) {
        fn = async () => config.translations as Translation;
      } else {
        throw new TypeError(
          `Translation of '${
            config.name
          }' must be an object of translated strings, a path to an object of translated strings, a function that returns one, or an async function that resolves to one. Got type: ${typeOf(
            config.translations,
          )}, value: ${config.translations}`,
        );
      }

      try {
        const translation = await fn();
        assertObject(
          translation,
          `Expected '${config.name}' translations to resolve to an object. Got type: %t, value: %v`,
        );
        cache.set(config.name, translation);
      } catch (err) {
        throw err;
      }
    }

    return cache.get(config.name);
  }

  const [$loaded, setLoaded] = signal(false);
  const [$language, _setLanguage] = signal<string>();
  const [$translation, setTranslation] = signal<Translation>();

  // Fallback labels for missing state and data.
  const [$noLanguageValue] = signal("[NO LANGUAGE SET]");

  // TODO: Keep an eye on this for memory leaks. Keeping a bunch of unused alternates with varied values might be an issue.
  const translationCache: [
    key: string,
    values: Record<string, Stringable | Signal<Stringable>> | undefined,
    readable: Signal<string>,
  ][] = [];

  function getCached(
    key: string,
    values?: Record<string, Stringable | Signal<Stringable>>,
  ): Signal<string> | undefined {
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

  async function setLanguage(tag: string) {
    let realTag!: string;

    if (tag === "auto") {
      let tags = [];

      if (typeof navigator === "object") {
        const nav = navigator as any;

        if (nav.languages?.length > 0) {
          tags.push(...nav.languages);
        } else if (nav.language) {
          tags.push(nav.language);
        } else if (nav.browserLanguage) {
          tags.push(nav.browserLanguage);
        } else if (nav.userLanguage) {
          tags.push(nav.userLanguage);
        }
      }

      for (const tag of tags) {
        if (languages.has(tag)) {
          // Found a matching language.
          realTag = tag;
        }
      }
    } else {
      // Tag is the actual tag to set.
      if (languages.has(tag)) {
        realTag = tag;
      }
    }

    if (realTag == null) {
      const firstLanguage = ctx.options.languages[0];
      if (firstLanguage) {
        realTag = firstLanguage.name;
      }
    }

    if (!realTag || !languages.has(realTag)) {
      throw new Error(`Language '${tag}' is not configured for this app.`);
    }

    const lang = languages.get(realTag)!;

    try {
      const translation = await getTranslation(lang);

      setTranslation(translation);
      _setLanguage(realTag);

      ctx.info("set language to " + realTag);
    } catch (error) {
      if (error instanceof Error) {
        ctx.crash(error);
      }
    }
  }

  // TODO: Determine and load default language.
  setLanguage(ctx.options.defaultLanguage ?? "auto").then(() => {
    setLoaded(true);
  });

  return {
    loaded: new Promise<void>((resolve, reject) => {
      const stop = $loaded.watch((isLoaded) => {
        if (isLoaded) {
          setTimeout(() => {
            stop();
            resolve();
          }, 0);
        }
      });
    }),

    $isLoaded: $loaded,
    $currentLanguage: $language,
    supportedLanguages: [...languages.keys()],

    setLanguage,

    /**
     * Returns a Readable of the translated value.

     * @param key - Key to the translated value.
     * @param values - A map of {{placeholder}} names and the values to replace them with.
     */
    translate(key: string, values?: Record<string, Stringable | Signal<Stringable>>): Signal<string> {
      if (!$language.get()) {
        return $noLanguageValue;
      }

      const cached = getCached(key, values);
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
          const $merged = derive([$translation, ...readables], (t, ...entryValues) => {
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

      const $replaced = derive([$translation], (t) => {
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
