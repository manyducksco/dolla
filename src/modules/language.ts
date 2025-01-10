// import { $, $$, isReadable, observe, type Readable } from "../state.js";
import { createSignal, derive, isSignal, signalify, type Signal } from "../signals.js";
import { isFunction, isObject, isString } from "../typeChecking.js";
import { type Stringable } from "../types.js";
import { deepEqual } from "../utils.js";
import { beforeMount } from "./core.js";
import http from "./http.js";
import { createLogger } from "./logging.js";

// ----- Types ----- //

// TODO: Is there a good way to represent infinitely nested recursive types?
/**
 * An object where values are either a translated string or another nested Translation object.
 */
type LanguageStrings = Record<
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
  fetch?: () => Promise<LanguageStrings>;
}

type LanguageOptions = {
  /**
   * Default language to load on startup
   */
  initialLanguage?: string;

  languages: LanguageConfig[];
};

// ----- Code ----- //

class Language {
  private config: LanguageConfig;
  strings?: LanguageStrings;

  constructor(config: LanguageConfig) {
    this.config = config;
  }

  async load(): Promise<LanguageStrings> {
    if (this.strings == null) {
      if (isFunction(this.config.fetch)) {
        const strings = await this.config.fetch();
        if (isObject(strings)) {
          this.strings = strings as LanguageStrings;
        } else {
          throw new Error(`Fetch function did not return an object of language strings: ${strings}`);
        }
      } else if (isString(this.config.path)) {
        const res = await http.get(this.config.path);
        if (res.status >= 200 && res.status < 300) {
          if (isObject(res.body)) {
            this.strings = res.body as LanguageStrings;
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

const debug = createLogger("dolla/language");

const languages = new Map<string, Language>();

let initialLanguage = "auto";
let setupHasRun = false;

const [$current, setCurrent] = createSignal<string>();
const [$strings, setStrings] = createSignal<LanguageStrings>();

export { $current };

// Fallback labels for missing state and data.
const $noLanguageValue = signalify("[NO LANGUAGE SET]");

// TODO: Keep an eye on this for memory leaks. Keeping a bunch of unused alternates with varied values might be an issue.
const translationCache: [
  key: string,
  values: Record<string, Stringable | Signal<Stringable>> | undefined,
  readable: Signal<string>,
][] = [];

function getCached(key: string, values?: Record<string, Stringable | Signal<Stringable>>): Signal<string> | undefined {
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

export function getSupportedLanguages() {
  return [...languages.keys()];
}

export function setup(config: LanguageOptions) {
  // Convert languages into Language instances.
  config.languages.forEach((entry) => {
    languages.set(entry.name, new Language(entry));
  });

  // Check that initialLanguage is actually registered.
  if (config.initialLanguage && config.initialLanguage !== "auto") {
    const isRegistered = config.languages.some((entry) => entry.name === config.initialLanguage);
    if (!isRegistered) {
      throw new Error(`Initial language '${config.initialLanguage}' has no registered translation.`);
    }
    initialLanguage = config.initialLanguage;
  }

  debug.info(
    `${languages.size} language${languages.size === 1 ? "" : "s"} supported: '${[...languages.keys()].join("', '")}'`,
  );
}

/**
 * Load language before the app mounts.
 */
beforeMount(async () => {
  if (languages.size > 0) {
    await setLanguage(initialLanguage);
  }
});

export async function setLanguage(tag: string) {
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
    const firstLanguage = languages.keys().next().value;
    if (firstLanguage) {
      realTag = firstLanguage;
    }
  }

  if (!realTag || !languages.has(realTag)) {
    throw new Error(`Language '${tag}' is not configured for this app.`);
  }

  const lang = languages.get(realTag)!;

  try {
    const translation = await lang.load();

    setStrings(translation);
    setCurrent(realTag);

    debug.info("set language to " + realTag);
  } catch (error) {
    if (error instanceof Error) {
      debug.crash(error);
    }
  }
}

/**
 * Returns a Signal containing the value at `key`.

 * @param key - Key to the translated value.
 * @param values - A map of {{placeholder}} names and the values to replace them with.
 */
export function t$(key: string, values?: Record<string, Stringable | Signal<Stringable>>): Signal<string> {
  if (!$current.get()) {
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
      const $merged = derive([$strings, ...readables], (t, ...entryValues) => {
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

  const $replaced = derive([$strings], (t) => {
    let result = resolve(t, key) || `[NO TRANSLATION: ${key}]`;

    if (values) {
      result = replaceMustaches(result, values);
    }

    return result;
  });

  translationCache.push([key, values, $replaced]);

  return $replaced;
}
