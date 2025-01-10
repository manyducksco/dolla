import colorHash from "simple-color-hash";
import { isString } from "../typeChecking.js";
import { _env, Environment } from "../modules/core.js";

export type LogLevelOptions = {
  info: boolean | Environment;
  log: boolean | Environment;
  warn: boolean | Environment;
  error: boolean | Environment;
};

export interface Logger {
  info(...args: any[]): void;
  log(...args: any[]): void;
  warn(...args: any[]): void;
  error(...args: any[]): void;
  crash(error: Error): void;
}

export interface LoggerErrorContext {
  error: Error;
  loggerName: string;
  uid?: string;
}

export type LoggerOptions = {
  /**
   * Console object to use for logging (mostly for testing). Uses window.console by default.
   */
  console?: any;

  /**
   * Unique ID to print with logs. Makes it easier to track down messages from specific view instances.
   */
  uid?: string;
};

let levels: LogLevelOptions = {
  info: Environment.development,
  log: Environment.development,
  warn: Environment.development,
  error: true,
};
let match: MatcherFunction = createMatcher("*,-dolla/*");

let crashCallbacks: Array<(context: LoggerErrorContext) => void> = [];

/**
 * Crash the app.
 */
export function _CRASH(context: LoggerErrorContext) {
  for (const callback of crashCallbacks) {
    callback(context);
  }
}

/**
 * Registers a callback to run when a logger receives a crash message.
 */
export function onCrash(callback: (context: LoggerErrorContext) => void) {
  crashCallbacks.push(callback);
}

/**
 * Update log level settings. Values that are not passed will remain unchanged.
 */
export function setLogLevels(options: Partial<LogLevelOptions>) {
  for (const key in options) {
    const value = options[key as keyof LogLevelOptions];
    if (value) {
      levels[key as keyof LogLevelOptions] = value;
    }
  }
}

export function setLogFilter(filter: string | RegExp) {
  match = createMatcher(filter);
}

export function createLogger(name: string, options?: LoggerOptions) {
  const _console = options?.console ?? getDefaultConsole();

  return {
    get info() {
      if (levels.info === false || (isString(levels.info) && levels.info !== _env) || !match(name)) {
        return noOp;
      } else {
        let label = `%c${name}`;
        if (options?.uid) {
          label += ` %c[uid: %c${options.uid}%c]`;
        } else {
          label += `%c%c%c`;
        }
        return _console.info.bind(
          _console,
          label,
          `color:${hash(label)};font-weight:bold`,
          `color:#777`,
          `color:#aaa`,
          `color:#777`,
        );
      }
    },

    get log() {
      if (levels.log === false || (isString(levels.log) && levels.log !== _env) || !match(name)) {
        return noOp;
      } else {
        let label = `%c${name}`;
        if (options?.uid) {
          label += ` %c[uid: %c${options.uid}%c]`;
        } else {
          label += `%c%c%c`;
        }
        return _console.log.bind(
          _console,
          label,
          `color:${hash(label)};font-weight:bold`,
          `color:#777`,
          `color:#aaa`,
          `color:#777`,
        );
      }
    },

    get warn() {
      if (levels.warn === false || (isString(levels.warn) && levels.warn !== _env) || !match(name)) {
        return noOp;
      } else {
        let label = `%c${name}`;
        if (options?.uid) {
          label += ` %c[uid: %c${options.uid}%c]`;
        } else {
          label += `%c%c%c`;
        }
        return _console.warn.bind(
          _console,
          label,
          `color:${hash(label)};font-weight:bold`,
          `color:#777`,
          `color:#aaa`,
          `color:#777`,
        );
      }
    },

    get error() {
      if (levels.error === false || (isString(levels.error) && levels.error !== _env) || !match(name)) {
        return noOp;
      } else {
        let label = `%c${name}`;
        if (options?.uid) {
          label += ` %c[uid: %c${options.uid}%c]`;
        } else {
          label += `%c%c%c`;
        }
        return _console.error.bind(
          _console,
          label,
          `color:${hash(label)};font-weight:bold`,
          `color:#777`,
          `color:#aaa`,
          `color:#777`,
        );
      }
    },

    crash(error: Error) {
      _CRASH({ error, loggerName: name, uid: options?.uid });
    },
  };
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
function createMatcher(pattern: string | RegExp) {
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
