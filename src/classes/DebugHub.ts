import colorHash from "simple-color-hash";
import { isString } from "../typeChecking.js";
import { type CrashCollector } from "./CrashCollector.js";

export type DebugOptions = {
  /**
   * Determines which debug channels are printed. Supports multiple filters with commas,
   * a prepended `-` to exclude a channel and wildcards to match partial channels.
   *
   * @example "store:*,-store:test" // matches everything starting with "store" except "store:test"
   */
  filter?: string | RegExp;

  /**
   * Print info messages when true. Default: true for development builds, false for production builds.
   */
  info?: boolean | "development";

  /**
   * Print log messages when true. Default: true for development builds, false for production builds.
   */
  log?: boolean | "development";

  /**
   * Print warn messages when true. Default: true for development builds, false for production builds.
   */
  warn?: boolean | "development";

  /**
   * Print error messages when true. Default: true.
   */
  error?: boolean | "development";
};

type DebugHubOptions = DebugOptions & {
  crashCollector: CrashCollector;
  mode: "development" | "production";
};

export interface DebugChannelOptions {
  name: string;
}

export interface DebugChannel {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
}

/**
 * The central trunk from which all channels branch.
 * Changing the filter here determines what kind of messages are printed across the app.
 */
export class DebugHub {
  #filter: string | RegExp = "*,-dolla/*";
  #matcher;
  #console;
  #options;

  constructor(options: DebugHubOptions, _console = getDefaultConsole()) {
    if (options.filter) {
      this.#filter = options.filter;
    }

    this.#matcher = makeMatcher(this.#filter);
    this.#console = _console;
    this.#options = options;
  }

  /**
   * Returns a debug channel labelled by `name`. Used for logging from components.
   */
  channel(options: DebugChannelOptions): DebugChannel {
    const _console = this.#console;
    const hubOptions = this.#options;

    const match = (value: string) => {
      return this.#matcher(value);
    };

    return {
      get info() {
        const name = options.name;

        if (
          hubOptions.info === false ||
          (isString(hubOptions.info) && hubOptions.info !== hubOptions.mode) ||
          !match(name)
        ) {
          return noOp;
        } else {
          const label = `%c${name}`;
          return _console.info.bind(_console, label, `color:${hash(label)};font-weight:bold`);
        }
      },

      get log() {
        const name = options.name;

        if (
          hubOptions.log === false ||
          (isString(hubOptions.log) && hubOptions.log !== hubOptions.mode) ||
          !match(name)
        ) {
          return noOp;
        } else {
          const label = `%c${name}`;
          return _console.log.bind(_console, label, `color:${hash(label)};font-weight:bold`);
        }
      },

      get warn() {
        const name = options.name;

        if (
          hubOptions.warn === false ||
          (isString(hubOptions.warn) && hubOptions.warn !== hubOptions.mode) ||
          !match(name)
        ) {
          return noOp;
        } else {
          const label = `%c${name}`;
          return _console.warn.bind(_console, label, `color:${hash(label)};font-weight:bold`);
        }
      },

      get error() {
        const name = options.name;

        if (
          hubOptions.error === false ||
          (isString(hubOptions.error) && hubOptions.error !== hubOptions.mode) ||
          !match(name)
        ) {
          return noOp;
        } else {
          const label = `%c${name}`;
          return _console.error.bind(_console, label, `color:${hash(label)};font-weight:bold`);
        }
      },
    };
  }

  get filter() {
    return this.#filter;
  }

  set filter(pattern) {
    this.#filter = pattern;
    this.#matcher = makeMatcher(pattern);
  }
}

/* ----- Helpers ----- */

function getDefaultConsole() {
  if (typeof window !== "undefined" && window.console) {
    return window.console;
  }

  if (typeof global !== "undefined" && global.console) {
    return global.console;
  }
}

const noOp = () => {};

function hash(value: string) {
  return colorHash({
    str: value,
    sat: { min: 0.35, max: 0.55 },
    light: { min: 0.6, max: 0.6 },
  });
}

type MatcherFunction = (value: string) => boolean;

/**
 * Parses a filter string into a match function.
 *
 * @param pattern - A string or regular expression that specifies a pattern for names of debug channels you want to display.
 */
export function makeMatcher(pattern: string | RegExp) {
  if (pattern instanceof RegExp) {
    return (value: string) => pattern.test(value);
  }

  const matchers: Record<"positive" | "negative", MatcherFunction[]> = {
    positive: [],
    negative: [],
  };

  const parts = pattern
    .split(",")
    .map((p) => p.trim())
    .filter((p) => p !== "");

  for (let part of parts) {
    let section: "positive" | "negative" = "positive";

    if (part.startsWith("-")) {
      section = "negative";
      part = part.slice(1);
    }

    if (part === "*") {
      matchers[section].push(function () {
        return true;
      });
    } else if (part.endsWith("*")) {
      matchers[section].push(function (value) {
        return value.startsWith(part.slice(0, part.length - 1));
      });
    } else {
      matchers[section].push(function (value) {
        return value === part;
      });
    }
  }

  return function (name: string) {
    const { positive, negative } = matchers;

    // Matching any negative matcher disqualifies.
    if (negative.some((fn) => fn(name))) {
      return false;
    }

    // Matching at least one positive matcher is required if any are specified.
    if (positive.length > 0 && !positive.some((fn) => fn(name))) {
      return false;
    }

    return true;
  };
}
